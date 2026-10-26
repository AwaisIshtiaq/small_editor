package com.example.pdfpoc;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriter;
import javax.imageio.stream.FileImageOutputStream;
import javax.imageio.stream.ImageOutputStream;

import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineNode;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;

/** Small PDFBox-based task executor. Only a bounded set of public tools is implemented. */
public final class PdfService {
    private PdfService() {
    }

    public static final class Result {
        public final Path path;
        public final String filename;
        public final List<String> items;
        public final List<String> warnings;

        Result(Path path, String filename, List<String> items, List<String> warnings) {
            this.path = path;
            this.filename = filename;
            this.items = items;
            this.warnings = warnings;
        }
    }

    public static Result execute(Store store, Store.Task task, Map<String, Object> request) throws Exception {
        List<Store.StoredFile> inputs = new ArrayList<>();
        for (String id : task.fileIds) {
            Store.StoredFile file = store.file(id);
            if (file != null) {
                inputs.add(file);
            }
        }
        if (inputs.isEmpty()) {
            throw new IllegalArgumentException("No uploaded file found for task");
        }
        return switch (task.type) {
            case "splitByPages" -> split(store, task, inputs.get(0), request);
            case "extractPages" -> extract(store, task, inputs.get(0), request);
            case "merge" -> merge(store, task, inputs);
            case "rotatePages" -> rotate(store, task, inputs.get(0), request);
            case "splitByBookmarks" -> splitByBookmarks(store, task, inputs.get(0), request);
            case "splitBySize" -> splitBySize(store, task, inputs.get(0), request);
            case "alternateMix" -> alternateMix(store, task, inputs, request);
            case "headerFooter" -> headerFooter(store, task, inputs.get(0), request);
            case "pdfToImage" -> pdfToImage(store, task, inputs.get(0), request);
            default -> throw new UnsupportedOperationException(
                    "Task type is not implemented in this PoC: " + task.type);
        };
    }

    private static Result split(Store store, Store.Task task, Store.StoredFile input,
                                Map<String, Object> request) throws Exception {
        int step = Math.max(1, Math.min(100, intValue(request.get("step"), 1)));
        String pages = stringValue(request.get("pages"), "all");
        String pattern = stringValue(request.get("outputFilenamePattern"), "[BASENAME]-[CURRENTPAGE]");
        String base = safeBase(input.originalName);
        Path work = Files.createDirectories(store.resultsDir().resolve(task.id));
        List<Path> outputs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        try (PDDocument source = PDDocument.load(input.path.toFile())) {
            int count = source.getNumberOfPages();
            if (count == 0) {
                throw new IllegalArgumentException("PDF has no pages");
            }
            List<int[]> groups;
            if (pages == null || pages.isBlank() || pages.equalsIgnoreCase("all")) {
                groups = new ArrayList<>();
                for (int start = 1; start <= count; start += step) {
                    int end = Math.min(count, start + step - 1);
                    groups.add(new int[]{start, end});
                }
            } else {
                groups = parseRanges(pages, count);
            }
            for (int[] range : groups) {
                String suffix = range[0] == range[1]
                        ? String.valueOf(range[0])
                        : range[0] + "-" + range[1];
                String filename = outputName(pattern, base, suffix);
                Path out = work.resolve(filename);
                writePages(source, range[0], range[1], out);
                outputs.add(out);
                names.add(filename);
            }
        }
        return packageResult(store, task, "poc-" + task.id + "-split", outputs, names);
    }

    private static Result extract(Store store, Store.Task task, Store.StoredFile input,
                                  Map<String, Object> request) throws Exception {
        String pages = stringValue(request.get("pages"), "");
        String requestedPattern = stringValue(request.get("outputFilenamePattern"), "[BASENAME]-[CURRENTPAGE]");
        String pattern = requestedPattern.isBlank() ? "[BASENAME]" : requestedPattern;
        String base = safeBase(input.originalName);
        Path work = Files.createDirectories(store.resultsDir().resolve(task.id));
        List<Path> outputs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<int[]> ranges;
        try (PDDocument source = PDDocument.load(input.path.toFile())) {
            int count = source.getNumberOfPages();
            ranges = parseRanges(pages, count);
            // The observed public default uses [BASENAME] and returns one PDF
            // containing all selected pages. A page/filenumber token keeps the
            // local extension behavior of one output per page range.
            boolean perRange = pattern.contains("[CURRENTPAGE]") || pattern.contains("[FILENUMBER]");
            if (!perRange) {
                String filename = outputName(pattern, base, "");
                Path out = work.resolve(filename);
                try (PDDocument target = new PDDocument()) {
                    for (int[] range : ranges) {
                        for (int page = range[0]; page <= range[1]; page++) {
                            target.importPage(source.getPage(page - 1));
                        }
                    }
                    target.save(out.toFile());
                }
                outputs.add(out);
                names.add(filename);
            } else {
                for (int[] range : ranges) {
                    String suffix = range[0] == range[1]
                            ? String.valueOf(range[0])
                            : range[0] + "-" + range[1];
                    String filename = outputName(pattern, base, suffix);
                    Path out = work.resolve(filename);
                    writePages(source, range[0], range[1], out);
                    outputs.add(out);
                    names.add(filename);
                }
            }
        }
        return packageResult(store, task, "poc-" + task.id + "-extract", outputs, names);
    }

    private static Result merge(Store store, Store.Task task, List<Store.StoredFile> inputs) throws Exception {
        String firstBase = safeBase(inputs.get(0).originalName);
        String filename = firstBase + "-merged.pdf";
        Path out = store.resultsDir().resolve(task.id + "-" + filename);
        PDFMergerUtility merger = new PDFMergerUtility();
        for (Store.StoredFile input : inputs) {
            merger.addSource(input.path.toFile());
        }
        merger.setDestinationFileName(out.toString());
        merger.mergeDocuments(MemoryUsageSetting.setupMainMemoryOnly());
        return new Result(out, filename, List.of(filename), List.of());
    }

    private static Result rotate(Store store, Store.Task task, Store.StoredFile input,
                                 Map<String, Object> request) throws Exception {
        String base = safeBase(input.originalName);
        String pattern = stringValue(request.get("outputFilenamePattern"), "");
        String filename = pattern.isBlank() ? base + ".pdf" : outputName(pattern, base, "");
        Path out = store.resultsDir().resolve(task.id + "-" + filename);
        int angle = intValue(request.get("angle"), 90);
        List<?> pageRotations = request.get("pageRotationsPerSource") instanceof List<?> list
                ? list : List.of();
        try (PDDocument doc = PDDocument.load(input.path.toFile())) {
            if (!pageRotations.isEmpty()) {
                for (Object item : pageRotations) {
                    String spec = Objects.toString(item, "").trim();
                    String[] parts = spec.split(":");
                    if (parts.length != 3) {
                        throw new IllegalArgumentException(
                                "pageRotationsPerSource entry must be file:page:rotation: " + spec);
                    }
                    int fileIndex;
                    int page;
                    int rotation;
                    try {
                        fileIndex = Integer.parseInt(parts[0].trim());
                        page = Integer.parseInt(parts[1].trim());
                        rotation = Integer.parseInt(parts[2].trim());
                    } catch (NumberFormatException e) {
                        throw new IllegalArgumentException(
                                "pageRotationsPerSource entry is not numeric: " + spec);
                    }
                    if (fileIndex != 0) {
                        throw new IllegalArgumentException(
                                "This PoC rotates a single input file; unsupported file index " + fileIndex);
                    }
                    if (page < 1 || page > doc.getNumberOfPages()) {
                        throw new IllegalArgumentException(
                                "Rotation page out of range for " + doc.getNumberOfPages() + " pages: " + page);
                    }
                    if (rotation % 90 != 0) {
                        throw new IllegalArgumentException("rotation must be a multiple of 90: " + rotation);
                    }
                    doc.getPage(page - 1).setRotation(((rotation % 360) + 360) % 360);
                }
            } else {
                if (angle % 90 != 0) {
                    throw new IllegalArgumentException("angle must be a multiple of 90");
                }
                angle = ((angle % 360) + 360) % 360;
                for (PDPage page : doc.getPages()) {
                    page.setRotation((page.getRotation() + angle) % 360);
                }
            }
            doc.save(out.toFile());
        }
        return new Result(out, filename, List.of(filename), List.of());
    }

    /**
     * Split at bookmarks. The public page exposes level 1-3, a title filter,
     * an "include extra page at the end" option and a filename pattern.
     * Coarse PDFs may have duplicate or missing destinations; those bookmarks
     * are skipped.
     */
    private static Result splitByBookmarks(Store store, Store.Task task, Store.StoredFile input,
                                           Map<String, Object> request) throws Exception {
        int level = Math.max(1, Math.min(3, intValue(request.get("bookmarksLevel"), 1)));
        String expression = stringValue(request.get("bookmarksExpression"), "").trim();
        boolean includePageAfter = booleanValue(request.get("includePageAfter"), false);
        String pattern = stringValue(request.get("outputFilenamePattern"), "[FILENUMBER]_[BOOKMARK_NAME]");
        String base = safeBase(input.originalName);
        Path work = Files.createDirectories(store.resultsDir().resolve(task.id));
        List<Path> outputs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (PDDocument source = PDDocument.load(input.path.toFile())) {
            int count = source.getNumberOfPages();
            PDDocumentOutline outline = source.getDocumentCatalog().getDocumentOutline();
            if (outline == null) {
                throw new IllegalArgumentException("PDF has no document outline/bookmarks");
            }
            List<PDOutlineItem> items = new ArrayList<>();
            collectBookmarks(outline, 1, level, items);
            if (items.isEmpty()) {
                throw new IllegalArgumentException("No bookmarks found at level " + level);
            }
            List<Bookmark> marks = new ArrayList<>();
            String needle = expression.toLowerCase(Locale.ROOT);
            for (PDOutlineItem item : items) {
                String title = item.getTitle() == null ? "" : item.getTitle();
                if (!needle.isEmpty() && !title.toLowerCase(Locale.ROOT).contains(needle)) {
                    continue;
                }
                PDPage destination = item.findDestinationPage(source);
                if (destination == null) {
                    warnings.add("Bookmark without a page destination skipped: " + title);
                    continue;
                }
                int page = source.getPages().indexOf(destination) + 1;
                if (page < 1 || page > count) {
                    warnings.add("Bookmark outside the page tree skipped: " + title);
                    continue;
                }
                marks.add(new Bookmark(title.isBlank() ? "bookmark" : title, page));
            }
            marks.sort(Comparator.comparingInt(Bookmark::page));
            if (marks.isEmpty()) {
                throw new IllegalArgumentException("No usable bookmarks matched the title filter");
            }
            for (int i = 0; i < marks.size(); i++) {
                Bookmark mark = marks.get(i);
                int start = mark.page;
                int end = i + 1 < marks.size() ? marks.get(i + 1).page - 1 : count;
                if (includePageAfter && end < count) {
                    end++;
                }
                if (end < start) {
                    warnings.add("Empty bookmark section skipped: " + mark.title);
                    continue;
                }
                String filename = bookmarkOutputName(pattern, base, i + 1, mark.title);
                Path out = work.resolve(filename);
                writePages(source, start, end, out);
                outputs.add(out);
                names.add(filename);
            }
        }
        return packageResult(store, task, "poc-" + task.id + "-bookmarks", outputs, names, warnings);
    }

    private static void collectBookmarks(PDOutlineNode node, int depth, int target,
                                         List<PDOutlineItem> out) {
        for (PDOutlineItem item : node.children()) {
            if (depth == target) {
                out.add(item);
            } else if (depth < target) {
                collectBookmarks(item, depth + 1, target, out);
            }
        }
    }

    /**
     * Approximate split-by-size. The public page accepts a size and KB/MB unit;
     * this implementation greedily writes candidate page ranges and keeps the
     * largest range that does not exceed the target. It is intentionally
     * simple and not a byte-for-byte match of the vendor's splitter.
     */
    private static Result splitBySize(Store store, Store.Task task, Store.StoredFile input,
                                      Map<String, Object> request) throws Exception {
        double size = doubleValue(request.get("size"), 1.5);
        String unit = stringValue(request.get("sizeUnit"), "MB").trim().toUpperCase(Locale.ROOT);
        long target = Math.max(1024L, Math.round(size * (unit.equals("KB") ? 1024L : 1024L * 1024L)));
        String base = safeBase(input.originalName);
        Path work = Files.createDirectories(store.resultsDir().resolve(task.id));
        List<Path> outputs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (PDDocument source = PDDocument.load(input.path.toFile())) {
            int count = source.getNumberOfPages();
            if (count == 0) {
                throw new IllegalArgumentException("PDF has no pages");
            }
            Path probe = work.resolve("probe.pdf");
            boolean wholeFits = Files.size(input.path) <= target;
            int start = 1;
            int probes = 0;
            while (start <= count) {
                int best = start;
                if (wholeFits) {
                    best = count;
                } else {
                    for (int end = start; end <= count; end++) {
                        if (++probes > 2000) {
                            warnings.add("Probe limit reached; remaining pages use one-page chunks");
                            break;
                        }
                        writePages(source, start, end, probe);
                        long bytes = Files.size(probe);
                        Files.deleteIfExists(probe);
                        if (bytes <= target) {
                            best = end;
                        } else {
                            break;
                        }
                    }
                }
                Path out = work.resolve(String.format(Locale.ROOT, "%s-part-%d.pdf", base, outputs.size() + 1));
                writePages(source, start, best, out);
                if (Files.size(out) > target) {
                    warnings.add("A single page exceeds the requested size: " + (start == best ? start : start + "-" + best));
                }
                outputs.add(out);
                names.add(out.getFileName().toString());
                start = best + 1;
            }
            Files.deleteIfExists(probe);
        }
        if (outputs.size() == 1) {
            Path only = outputs.get(0);
            String singleName = base + ".pdf";
            Path targetPath = store.resultsDir().resolve(task.id + "-" + singleName);
            Files.move(only, targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return new Result(targetPath, singleName, List.of(singleName), warnings);
        }
        return packageResult(store, task, "poc-" + task.id + "-by-size", outputs, names, warnings);
    }

    /**
     * Alternate pages from two or more documents. The observed form sends
     * parallel files[], reverse[], step[] and (sometimes) repeat[] arrays.
     * Default step=1 and regular order produce A1, B1, A2, B2...
     */
    private static Result alternateMix(Store store, Store.Task task, List<Store.StoredFile> inputs,
                                       Map<String, Object> request) throws Exception {
        if (inputs.size() < 2) {
            throw new IllegalArgumentException("alternateMix needs at least two input files");
        }
        List<Boolean> reverse = booleanList(request, "reverse", inputs.size());
        List<Integer> steps = intList(request, "step", inputs.size(), 1);
        List<Boolean> repeat = booleanList(request, "repeat", inputs.size());
        List<PDDocument> docs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        try {
            for (Store.StoredFile input : inputs) {
                docs.add(PDDocument.load(input.path.toFile()));
                names.add(safeBase(input.originalName));
            }
            String filename = names.get(0) + "-" + names.get(1) + "-mixed.pdf";
            Path out = store.resultsDir().resolve(task.id + "-" + filename);
            List<Integer> maxPages = new ArrayList<>();
            int sum = 0;
            for (PDDocument doc : docs) {
                maxPages.add(doc.getNumberOfPages());
                sum += doc.getNumberOfPages();
            }
            if (sum == 0) {
                throw new IllegalArgumentException("Input PDFs have no pages");
            }
            int[] cursor = new int[docs.size()];
            for (int i = 0; i < docs.size(); i++) {
                cursor[i] = reverse.get(i) ? maxPages.get(i) - 1 : 0;
            }
            int repeatBudget = Math.max(sum, maxPages.stream().mapToInt(Integer::intValue).max().orElse(0) * docs.size());
            int emitted = 0;
            int guard = 0;
            List<String> warnings = new ArrayList<>();
            try (PDDocument target = new PDDocument()) {
                while (emitted < sum && guard++ < sum + repeatBudget + 10) {
                    boolean any = false;
                    for (int i = 0; i < docs.size(); i++) {
                        if (cursor[i] < 0 || cursor[i] >= maxPages.get(i)) {
                            if (repeat.get(i) && emitted < repeatBudget && maxPages.get(i) > 0) {
                                cursor[i] = reverse.get(i) ? maxPages.get(i) - 1 : 0;
                            } else {
                                continue;
                            }
                        }
                        int take = Math.max(1, steps.get(i));
                        for (int k = 0; k < take && cursor[i] >= 0 && cursor[i] < maxPages.get(i); k++) {
                            target.importPage(docs.get(i).getPage(cursor[i]));
                            cursor[i] += reverse.get(i) ? -1 : 1;
                            emitted++;
                            any = true;
                        }
                    }
                    if (!any) {
                        boolean restarted = false;
                        for (int i = 0; i < docs.size(); i++) {
                            if (repeat.get(i) && maxPages.get(i) > 0 && emitted < repeatBudget) {
                                cursor[i] = reverse.get(i) ? maxPages.get(i) - 1 : 0;
                                restarted = true;
                            }
                        }
                        if (!restarted) {
                            break;
                        }
                    }
                }
                if (emitted == 0) {
                    throw new IllegalArgumentException("Alternate mix produced no pages");
                }
                target.save(out.toFile());
            }
            return new Result(out, filename, List.of(filename), warnings);
        } finally {
            for (PDDocument doc : docs) {
                try {
                    doc.close();
                } catch (IOException ignored) {
                    // best effort
                }
            }
        }
    }

    /**
     * Add the observed default-style header/footer text. Supported tokens:
     * [PAGE_ARABIC], [PAGE_ROMAN], [TOTAL_PAGES_ARABIC], [TOTAL_PAGES_ROMAN]
     * and [BASE_NAME]. Unknown tokens are left literal.
     */
    private static Result headerFooter(Store store, Store.Task task, Store.StoredFile input,
                                       Map<String, Object> request) throws Exception {
        String base = safeBase(input.originalName);
        String pattern = stringValue(request.get("pattern"), "");
        if (pattern.isBlank()) {
            Object custom = request.containsKey("hf-format-customize")
                    ? request.get("hf-format-customize")
                    : request.get("hf-format-customize[]");
            if (custom instanceof List<?> list) {
                StringBuilder joined = new StringBuilder();
                for (Object item : list) {
                    if (item != null) {
                        if (!joined.isEmpty()) {
                            joined.append(' ');
                        }
                        joined.append(item);
                    }
                }
                pattern = joined.toString();
            }
        }
        if (pattern.isBlank()) {
            pattern = "Page [PAGE_ARABIC]";
        }
        String pageLocation = stringValue(request.get("pageLocation"), "top-center");
        String fontName = stringValue(request.get("font"), "times_roman");
        int fontSize = Math.max(6, Math.min(72, intValue(request.get("fontSize"), 10)));
        String colorText = stringValue(request.get("color"), "#000000");
        boolean addMargins = booleanValue(request.get("addMargins"), false);
        String pages = stringValue(request.get("pages"), "");
        int startFrom = intValue(request.get("pageCountStartFrom"), 0);
        if (startFrom <= 0) {
            startFrom = 1;
        }
        String outputPattern = stringValue(request.get("outputFilenamePattern"), "");
        String filename = outputPattern == null || outputPattern.isBlank()
                ? base + ".pdf"
                : bookmarkOutputName(outputPattern, base, 1, base);
        Path out = store.resultsDir().resolve(task.id + "-" + filename);
        PDType1Font font = switch (fontName.toLowerCase(Locale.ROOT)) {
            case "helvetica" -> PDType1Font.HELVETICA;
            case "courier" -> PDType1Font.COURIER;
            default -> PDType1Font.TIMES_ROMAN;
        };
        Color color = parseColor(colorText);
        try (PDDocument doc = PDDocument.load(input.path.toFile())) {
            int count = doc.getNumberOfPages();
            List<Integer> selected = selectedPages(pages, count);
            for (int pageNumber : selected) {
                PDPage page = doc.getPage(pageNumber - 1);
                String text = renderTokens(pattern, pageNumber + startFrom - 1, count, base);
                if (text.isBlank()) {
                    continue;
                }
                float width = page.getMediaBox().getWidth();
                float height = page.getMediaBox().getHeight();
                float textWidth = font.getStringWidth(text) / 1000f * fontSize;
                float margin = addMargins ? 50f : 30f;
                float x;
                float y;
                String location = pageLocation == null ? "top-center" : pageLocation.toLowerCase(Locale.ROOT);
                if (location.endsWith("left")) {
                    x = margin;
                } else if (location.endsWith("right")) {
                    x = Math.max(margin, width - margin - textWidth);
                } else {
                    x = Math.max(margin, (width - textWidth) / 2f);
                }
                if (location.startsWith("bottom")) {
                    y = margin;
                } else {
                    y = Math.max(margin, height - margin - fontSize);
                }
                try (PDPageContentStream stream = new PDPageContentStream(
                        doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    stream.beginText();
                    stream.setFont(font, fontSize);
                    stream.setNonStrokingColor(color);
                    stream.newLineAtOffset(x, y);
                    stream.showText(text);
                    stream.endText();
                }
            }
            doc.save(out.toFile());
        }
        return new Result(out, filename, List.of(filename), List.of());
    }

    /**
     * Render selected pages to JPG/PNG/TIFF. TIFF multi-page output is
     * attempted with the JDK ImageIO TIFF writer when available.
     */
    private static Result pdfToImage(Store store, Store.Task task, Store.StoredFile input,
                                     Map<String, Object> request) throws Exception {
        int dpi = Math.max(36, Math.min(600, intValue(request.get("resolution"), 150)));
        String format = stringValue(request.get("imageFormat"), "jpg").toLowerCase(Locale.ROOT);
        if (format.equals("jpeg")) {
            format = "jpg";
        }
        if (!format.equals("jpg") && !format.equals("png") && !format.equals("tiff")) {
            throw new IllegalArgumentException("imageFormat must be jpg, png or tiff");
        }
        String colorType = stringValue(request.get("imageColorType"), "rgb").toLowerCase(Locale.ROOT);
        String pattern = stringValue(request.get("outputFilenamePattern"), "[BASENAME]-[CURRENTPAGE]");
        boolean allPages = booleanValue(request.get("allPages"), false);
        boolean singleTiff = booleanValue(request.get("tiffSingleFileWithAllPages"), false)
                && format.equals("tiff");
        String pages = stringValue(request.get("pages"), "");
        String base = safeBase(input.originalName);
        Path work = Files.createDirectories(store.resultsDir().resolve(task.id));
        List<Path> outputs = new ArrayList<>();
        List<String> names = new ArrayList<>();
        try (PDDocument doc = PDDocument.load(input.path.toFile())) {
            int count = doc.getNumberOfPages();
            List<Integer> selected = allPages || pages == null || pages.isBlank()
                    ? selectedPages("all", count)
                    : selectedPages(pages, count);
            if (selected.isEmpty()) {
                throw new IllegalArgumentException("No pages selected for image conversion");
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            List<BufferedImage> singleTiffImages = new ArrayList<>();
            int sequence = 0;
            for (int pageNumber : selected) {
                sequence++;
                BufferedImage image = renderer.renderImageWithDPI(pageNumber - 1, dpi, ImageType.RGB);
                image = convertColor(image, colorType);
                if (singleTiff) {
                    singleTiffImages.add(image);
                    continue;
                }
                String filename = imageName(pattern, base, pageNumber, sequence, format);
                Path out = work.resolve(filename);
                writeImage(image, format, out);
                outputs.add(out);
                names.add(filename);
            }
            if (singleTiff) {
                String filename = base + "-all-pages.tiff";
                Path out = work.resolve(filename);
                writeTiffSequence(singleTiffImages, out);
                outputs.add(out);
                names.add(filename);
            }
        }
        return packageResult(store, task, "poc-" + task.id + "-images", outputs, names);
    }

    private static BufferedImage convertColor(BufferedImage image, String colorType) {
        if (colorType == null || colorType.isBlank() || colorType.equals("rgb")) {
            return toRgb(image);
        }
        if (colorType.equals("grayscale") || colorType.equals("grey")) {
            BufferedImage gray = new BufferedImage(
                    image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
            Graphics2D g = gray.createGraphics();
            g.drawImage(image, 0, 0, null);
            g.dispose();
            return gray;
        }
        if (colorType.equals("black_white") || colorType.equals("black-and-white")) {
            BufferedImage gray = new BufferedImage(
                    image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
            Graphics2D g = gray.createGraphics();
            g.drawImage(image, 0, 0, null);
            g.dispose();
            BufferedImage bw = new BufferedImage(
                    image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_BINARY);
            Graphics2D bwGraphics = bw.createGraphics();
            bwGraphics.setRenderingHint(RenderingHints.KEY_DITHERING, RenderingHints.VALUE_DITHER_ENABLE);
            bwGraphics.drawImage(gray, 0, 0, null);
            bwGraphics.dispose();
            return bw;
        }
        return toRgb(image);
    }

    private static BufferedImage toRgb(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) {
            return image;
        }
        BufferedImage rgb = new BufferedImage(
                image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(image, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static void writeImage(BufferedImage image, String format, Path out) throws IOException {
        String writerFormat = format.equals("jpg") ? "jpeg" : format;
        boolean ok = ImageIO.write(image, writerFormat, out.toFile());
        if (!ok) {
            throw new IOException("No ImageIO writer for " + format);
        }
    }

    private static void writeTiffSequence(List<BufferedImage> images, Path out) throws IOException {
        if (images.isEmpty()) {
            throw new IllegalArgumentException("No images to write");
        }
        var writers = ImageIO.getImageWritersByFormatName("tiff");
        if (!writers.hasNext()) {
            throw new IOException("No TIFF ImageIO writer available in this JDK");
        }
        ImageWriter writer = writers.next();
        try (ImageOutputStream stream = new FileImageOutputStream(out.toFile())) {
            writer.setOutput(stream);
            writer.prepareWriteSequence(null);
            for (BufferedImage image : images) {
                writer.writeToSequence(new IIOImage(image, null, null), null);
            }
            writer.endWriteSequence();
        } finally {
            writer.dispose();
        }
    }

    private static Result packageResult(Store store, Store.Task task, String baseName,
                                        List<Path> outputs, List<String> names) throws IOException {
        return packageResult(store, task, baseName, outputs, names, List.of());
    }

    private static Result packageResult(Store store, Store.Task task, String baseName,
                                        List<Path> outputs, List<String> names,
                                        List<String> warnings) throws IOException {
        if (outputs.isEmpty()) {
            throw new IllegalArgumentException("Task produced no output");
        }
        if (outputs.size() == 1) {
            Path only = outputs.get(0);
            Path target = store.resultsDir().resolve(task.id + "-" + names.get(0));
            Files.move(only, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return new Result(target, names.get(0), List.of(names.get(0)), warnings);
        }
        String zipName = baseName + ".zip";
        Path zip = store.resultsDir().resolve(task.id + "-" + zipName);
        try (OutputStream raw = Files.newOutputStream(zip);
             ZipOutputStream zos = new ZipOutputStream(raw)) {
            for (int i = 0; i < outputs.size(); i++) {
                ZipEntry entry = new ZipEntry(names.get(i));
                zos.putNextEntry(entry);
                Files.copy(outputs.get(i), zos);
                zos.closeEntry();
            }
        }
        return new Result(zip, zipName, List.copyOf(names), warnings);
    }

    private static void writePages(PDDocument source, int first, int last, Path out) throws IOException {
        try (PDDocument target = new PDDocument()) {
            for (int page = first; page <= last; page++) {
                target.importPage(source.getPage(page - 1));
            }
            target.save(out.toFile());
        }
    }

    private static String outputName(String pattern, String base, String suffix) {
        String name = pattern == null || pattern.isBlank() ? "[BASENAME]-[CURRENTPAGE]" : pattern;
        name = name.replace("[BASENAME]", base).replace("[CURRENTPAGE]", suffix);
        name = name.replaceAll("[\\\\/:*?\"<>|]+", "_");
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            name += ".pdf";
        }
        if (name.equals(".pdf")) {
            name = base + "-" + suffix + ".pdf";
        }
        return name;
    }

    private static String bookmarkOutputName(String pattern, String base, int index, String title) {
        String name = pattern == null || pattern.isBlank() ? "[FILENUMBER]_[BOOKMARK_NAME]" : pattern;
        String safeTitle = title == null ? "bookmark" : title
                .replaceAll("[\\\\/:*?\"<>|]+", "_")
                .replaceAll("\\s+", "_")
                .trim();
        if (safeTitle.isBlank()) {
            safeTitle = "bookmark";
        }
        name = name.replace("[BASENAME]", base)
                .replace("[FILENUMBER]", String.valueOf(index))
                .replace("[CURRENTPAGE]", String.valueOf(index))
                .replace("[BOOKMARK_NAME_STRICT]", safeTitle.replaceAll("[^A-Za-z0-9._-]+", "_"))
                .replace("[BOOKMARK_NAME]", safeTitle);
        name = name.replaceAll("[\\\\/:*?\"<>|]+", "_");
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            name += ".pdf";
        }
        if (name.equals(".pdf")) {
            name = base + "-" + index + ".pdf";
        }
        return name;
    }

    private static String imageName(String pattern, String base, int page, int sequence, String format) {
        String name = pattern == null || pattern.isBlank() ? "[BASENAME]-[CURRENTPAGE]" : pattern;
        boolean hasPageToken = name.contains("[CURRENTPAGE]") || name.contains("[FILENUMBER]");
        name = name.replace("[BASENAME]", base)
                .replace("[CURRENTPAGE]", String.valueOf(page))
                .replace("[FILENUMBER]", String.valueOf(sequence));
        name = name.replaceAll("[\\\\/:*?\"<>|]+", "_");
        String lower = name.toLowerCase(Locale.ROOT);
        for (String ext : List.of(".jpg", ".jpeg", ".png", ".tif", ".tiff")) {
            if (lower.endsWith(ext)) {
                name = name.substring(0, name.length() - ext.length());
                break;
            }
        }
        String extension = switch (format) {
            case "png" -> ".png";
            case "tiff" -> ".tiff";
            default -> ".jpg";
        };
        if (!hasPageToken) {
            name += "-" + page;
        }
        return name + extension;
    }

    private static String renderTokens(String pattern, int pageNumber, int totalPages, String base) {
        return pattern
                .replace("[PAGE_ARABIC]", String.valueOf(pageNumber))
                .replace("[PAGE_ROMAN]", roman(pageNumber))
                .replace("[TOTAL_PAGES_ARABIC]", String.valueOf(totalPages))
                .replace("[TOTAL_PAGES_ROMAN]", roman(totalPages))
                .replace("[BASE_NAME]", base);
    }

    private static String roman(int value) {
        if (value <= 0 || value >= 4000) {
            return String.valueOf(value);
        }
        int[] numbers = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
        String[] symbols = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        StringBuilder out = new StringBuilder();
        int remaining = value;
        for (int i = 0; i < numbers.length; i++) {
            while (remaining >= numbers[i]) {
                out.append(symbols[i]);
                remaining -= numbers[i];
            }
        }
        return out.toString();
    }

    private static Color parseColor(String value) {
        try {
            if (value != null && value.matches("#[0-9a-fA-F]{6}")) {
                return Color.decode(value);
            }
        } catch (NumberFormatException ignored) {
            // fall through
        }
        return Color.BLACK;
    }

    private static List<Integer> selectedPages(String spec, int count) {
        List<Integer> pages = new ArrayList<>();
        if (spec == null || spec.isBlank() || spec.equalsIgnoreCase("all")) {
            for (int i = 1; i <= count; i++) {
                pages.add(i);
            }
            return pages;
        }
        for (int[] range : parseRanges(spec, count)) {
            for (int page = range[0]; page <= range[1]; page++) {
                pages.add(page);
            }
        }
        return pages;
    }

    private static List<Boolean> booleanList(Map<String, Object> request, String key, int expected) {
        Object value = request.containsKey(key + "[]") ? request.get(key + "[]") : request.get(key);
        List<Boolean> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                out.add(Boolean.parseBoolean(String.valueOf(item)));
            }
        } else if (value != null) {
            out.add(Boolean.parseBoolean(String.valueOf(value)));
        }
        while (out.size() < expected) {
            out.add(false);
        }
        return out;
    }

    private static List<Integer> intList(Map<String, Object> request, String key, int expected, int fallback) {
        Object value = request.containsKey(key + "[]") ? request.get(key + "[]") : request.get(key);
        List<Integer> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                out.add(intValue(item, fallback));
            }
        } else if (value != null) {
            out.add(intValue(value, fallback));
        }
        while (out.size() < expected) {
            out.add(fallback);
        }
        return out;
    }

    private static String safeBase(String originalName) {
        String name = originalName == null ? "document.pdf" : originalName;
        try {
            name = Path.of(name).getFileName().toString();
        } catch (Exception ignored) {
            // keep as-is
        }
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            name = name.substring(0, dot);
        }
        name = name.replaceAll("[^A-Za-z0-9._-]+", "_");
        if (name.isBlank() || name.equals(".") || name.equals("..")) {
            name = "document";
        }
        return name;
    }

    private static List<int[]> parseRanges(String spec, int pageCount) {
        List<int[]> ranges = new ArrayList<>();
        if (spec == null || spec.isBlank() || spec.equalsIgnoreCase("all")) {
            ranges.add(new int[]{1, pageCount});
            return ranges;
        }
        for (String raw : spec.split(",")) {
            String token = raw.trim();
            if (token.isEmpty()) {
                continue;
            }
            int dash = token.indexOf('-');
            int first;
            int last;
            if (dash < 0) {
                first = last = Integer.parseInt(token);
            } else {
                String left = token.substring(0, dash).trim();
                String right = token.substring(dash + 1).trim();
                first = left.isEmpty() ? 1 : Integer.parseInt(left);
                last = right.isEmpty() ? pageCount : Integer.parseInt(right);
            }
            if (first < 1 || last > pageCount || first > last) {
                throw new IllegalArgumentException(
                        "Invalid page range '" + token + "' for " + pageCount + " pages");
            }
            ranges.add(new int[]{first, last});
        }
        if (ranges.isEmpty()) {
            ranges.add(new int[]{1, pageCount});
        }
        return ranges;
    }

    private static String stringValue(Object value, String fallback) {
        return value == null ? fallback : Objects.toString(value, fallback);
    }

    private static int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double doubleValue(Object value, double fallback) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text) {
            try {
                return Double.parseDouble(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static boolean booleanValue(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value != null) {
            return Boolean.parseBoolean(String.valueOf(value));
        }
        return fallback;
    }

    private record Bookmark(String title, int page) {
    }
}
