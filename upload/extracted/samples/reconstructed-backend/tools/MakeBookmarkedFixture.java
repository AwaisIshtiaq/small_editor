import java.io.File;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineNode;

/**
 * Create a deterministic bookmark fixture from the shared 4-page sample.
 * Usage: java -cp "out;lib/*" MakeBookmarkedFixture input.pdf output.pdf
 */
public final class MakeBookmarkedFixture {
    private MakeBookmarkedFixture() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("usage: MakeBookmarkedFixture input.pdf output.pdf");
        }
        try (PDDocument doc = PDDocument.load(new File(args[0]))) {
            if (doc.getNumberOfPages() < 4) {
                throw new IllegalArgumentException("fixture needs at least 4 pages");
            }
            PDDocumentOutline outline = new PDDocumentOutline();
            doc.getDocumentCatalog().setDocumentOutline(outline);
            PDOutlineItem chapter1 = item(doc, "Chapter 1", 1);
            PDOutlineItem chapter2 = item(doc, "Chapter 2", 2);
            PDOutlineItem chapter3 = item(doc, "Chapter 3", 4);
            outline.addLast(chapter1);
            outline.addLast(chapter2);
            outline.addLast(chapter3);
            chapter1.addLast(item(doc, "Section 1.1", 1));
            chapter2.addLast(item(doc, "Section 2.1", 3));
            doc.save(args[1]);
        }
    }

    private static PDOutlineItem item(PDDocument doc, String title, int pageNumber) {
        PDOutlineItem item = new PDOutlineItem();
        item.setTitle(title);
        PDPage page = doc.getPage(pageNumber - 1);
        item.setDestination(page);
        return item;
    }

    private static void unused(PDOutlineNode node) {
        // Keep the import explicit for readers comparing the PDFBox API.
    }
}
