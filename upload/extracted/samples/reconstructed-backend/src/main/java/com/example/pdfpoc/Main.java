package com.example.pdfpoc;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Independent local backend PoC.
 *
 * <p>It deliberately uses the JDK HTTP server and Apache PDFBox, not the Sejda
 * SDK. The public sejda.com lifecycle is the behavioural reference; this is
 * not a copy of Sejda's server and it is not production-ready.</p>
 */
public final class Main {
    private static final int MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
    private static final String VERSION = "0.2.0";

    private final int port;
    private final Store store;
    private final ExecutorService httpPool = Executors.newFixedThreadPool(4);
    private final ExecutorService taskPool = Executors.newFixedThreadPool(2);
    private final Instant startedAt = Instant.now();
    private HttpServer server;

    private Main(int port, Store store) {
        this.port = port;
        this.store = store;
    }

    public static void main(String[] args) throws Exception {
        int port = parseInt(System.getenv().getOrDefault("PORT", "18080"), 18080);
        Store store = new Store();
        Main app = new Main(port, store);
        app.start();
    }

    private void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", this::handle);
        server.setExecutor(httpPool);
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("shutting down; deleting " + store.root());
            server.stop(0);
            httpPool.shutdownNow();
            taskPool.shutdownNow();
            store.cleanup();
        }));
        System.out.println("reconstructed-backend-poc " + VERSION);
        System.out.println("listening on http://127.0.0.1:" + port);
        System.out.println("data dir: " + store.root());
        System.out.println("pdfbox: " + pdfboxVersion());
        System.out.println("health: GET /health");
        System.out.println("upload: POST /api/files/upload (multipart field 'file' or raw application/pdf)");
        System.out.println("task:   POST /api/tasks (JSON; 9 bounded task types; see /)");
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            commonHeaders(exchange);
            route(exchange);
        } catch (IllegalArgumentException e) {
            sendJson(exchange, 400, Json.object("error", e.getMessage()));
        } catch (Exception e) {
            sendJson(exchange, 500, Json.object(
                    "error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
        } finally {
            exchange.close();
        }
    }

    private void route(HttpExchange exchange) throws Exception {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        String path = exchange.getRequestURI().getPath();
        List<String> parts = pathParts(path);

        if (method.equals("GET") && path.equals("/health")) {
            sendJson(exchange, 200, Json.object(
                    "status", "ok",
                    "service", "reconstructed-backend-poc",
                    "version", VERSION,
                    "startedAt", startedAt.toString(),
                    "uptimeSeconds", java.time.Duration.between(startedAt, Instant.now()).toSeconds(),
                    "dataDir", store.root().toString(),
                    "pdfbox", pdfboxVersion()));
            return;
        }

        if (method.equals("GET") && path.equals("/")) {
            sendHtml(exchange, 200, indexHtml());
            return;
        }

        if (method.equals("POST") && path.equals("/api/files/upload-check")) {
            sendJson(exchange, 200, Json.object("status", "ok"));
            return;
        }

        if (method.equals("POST") && path.equals("/api/files/upload")) {
            upload(exchange);
            return;
        }

        if (method.equals("POST") && path.equals("/api/tasks")) {
            submitTask(exchange);
            return;
        }

        if (parts.size() >= 3 && parts.get(0).equals("api") && parts.get(1).equals("tasks")) {
            String taskId = parts.get(2);
            if (method.equals("GET") && parts.size() == 4 && parts.get(3).equals("change")) {
                taskChange(exchange, taskId);
                return;
            }
            if (method.equals("GET") && parts.size() >= 5 && parts.get(3).equals("download")) {
                download(exchange, taskId, decode(parts.get(4)));
                return;
            }
            if (method.equals("DELETE") && parts.size() == 3) {
                deleteTask(exchange, taskId);
                return;
            }
            if (method.equals("POST") && parts.size() == 4 && parts.get(3).equals("cancel")) {
                cancelTask(exchange, taskId);
                return;
            }
        }

        if (parts.size() >= 3 && parts.get(0).equals("api") && parts.get(1).equals("files")) {
            String fileId = parts.get(2);
            if (method.equals("POST") && parts.size() == 4 && parts.get(3).equals("password")) {
                sendJson(exchange, 501, Json.object(
                        "error", "not implemented in the PoC",
                        "endpoint", "POST /api/files/{id}/password"));
                return;
            }
            if (method.equals("DELETE") && parts.size() == 3) {
                deleteFile(exchange, fileId);
                return;
            }
        }

        sendJson(exchange, 404, Json.object(
                "error", "not found",
                "method", method,
                "path", path));
    }

    private void upload(HttpExchange exchange) throws IOException {
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        byte[] body = readBody(exchange, MAX_UPLOAD_BYTES);
        byte[] data;
        String filename;
        if (contentType != null && (contentType.toLowerCase(Locale.ROOT).startsWith("application/pdf")
                || contentType.toLowerCase(Locale.ROOT).startsWith("application/octet-stream"))) {
            data = body;
            String header = exchange.getRequestHeaders().getFirst("X-Filename");
            filename = header == null || header.isBlank() ? "upload.pdf" : header;
        } else if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("multipart/form-data")) {
            Map<String, Multipart.Part> parts = Multipart.parse(body, contentType);
            Multipart.Part part = parts.get("file");
            if (part == null) {
                for (Multipart.Part candidate : parts.values()) {
                    if (candidate.filename != null) {
                        part = candidate;
                        break;
                    }
                }
            }
            if (part == null) {
                throw new IllegalArgumentException("multipart body has no file part");
            }
            data = part.bytes();
            filename = part.filename == null || part.filename.isBlank() ? "upload.pdf" : part.filename;
        } else {
            throw new IllegalArgumentException("expected multipart/form-data or application/pdf");
        }

        if (data.length == 0) {
            throw new IllegalArgumentException("empty upload");
        }
        if (!looksLikePdf(data)) {
            throw new IllegalArgumentException("upload does not start with %PDF-");
        }
        Store.StoredFile stored = store.putFile(filename, data);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", stored.id);
        response.put("filename", stored.originalName);
        response.put("bytes", stored.bytes);
        sendJson(exchange, 200, response);
    }

    private void submitTask(HttpExchange exchange) throws IOException {
        byte[] body = readBody(exchange, 2 * 1024 * 1024);
        String text = new String(body, StandardCharsets.UTF_8);
        Map<String, Object> request = Json.parseObject(text);
        String type = stringValue(request.get("type"), "splitByPages");

        List<String> fileIds = new ArrayList<>();
        Object filesValue = request.get("files");
        if (filesValue instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) {
                    fileIds.add(String.valueOf(item));
                }
            }
        }
        if (fileIds.isEmpty() && request.get("fileId") != null) {
            fileIds.add(String.valueOf(request.get("fileId")));
        }
        if (fileIds.isEmpty()) {
            throw new IllegalArgumentException("task needs a non-empty 'files' array");
        }
        for (String id : fileIds) {
            if (store.file(id) == null) {
                throw new IllegalArgumentException("unknown file id: " + id);
            }
        }
        if (!type.equals("merge") && !type.equals("alternateMix") && fileIds.size() > 1) {
            throw new IllegalArgumentException("this PoC accepts one input file for task type " + type);
        }

        Store.Task task = store.createTask(type, fileIds);
        task.future = taskPool.submit(() -> runTask(task, request));
        sendJsonString(exchange, 200, task.id);
    }

    private void runTask(Store.Task task, Map<String, Object> request) {
        try {
            Thread.sleep(150); // make the asynchronous state observable to a poller
            PdfService.Result result = PdfService.execute(store, task, request);
            task.resultPath = result.path;
            task.resultFilename = result.filename;
            task.resultBytes = Files.size(result.path);
            task.resultItems = result.items;
            task.warnings = result.warnings;
            task.status = "Completed";
            task.completedAt = Instant.now();
        } catch (CancellationException e) {
            task.status = "Canceled";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            task.status = "Canceled";
        } catch (Exception e) {
            task.status = "Failed";
            task.error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        }
    }

    private void taskChange(HttpExchange exchange, String taskId) throws IOException {
        Store.Task task = store.task(taskId);
        if (task == null) {
            sendJson(exchange, 404, Json.object("error", "unknown task", "id", taskId));
            return;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", task.id);
        response.put("type", task.type);
        response.put("status", task.status);
        response.put("warnings", task.warnings);
        if (task.status.equals("Completed")) {
            response.put("resultFilename", task.resultFilename);
            response.put("resultFileSize", task.resultBytes);
            response.put("resultItems", task.resultItems);
            response.put("resultFullUrlPattern", "http://127.0.0.1:" + port
                    + "/api/tasks/" + task.id + "/download/{{filename}}");
            response.put("completedAt", task.completedAt == null ? null : task.completedAt.toString());
        } else if (task.status.equals("Failed")) {
            response.put("error", task.error);
        }
        sendJson(exchange, 200, response);
    }

    private void download(HttpExchange exchange, String taskId, String filename) throws IOException {
        Store.Task task = store.task(taskId);
        if (task == null) {
            sendJson(exchange, 404, Json.object("error", "unknown task", "id", taskId));
            return;
        }
        if (!task.status.equals("Completed") || task.resultPath == null) {
            sendJson(exchange, 409, Json.object("error", "task is not completed", "status", task.status));
            return;
        }
        String requested = Path.of(filename).getFileName().toString();
        if (!requested.equals(task.resultFilename) && !task.resultItems.contains(requested)) {
            sendJson(exchange, 404, Json.object(
                    "error", "unknown result file", "filename", requested,
                    "available", task.resultFilename));
            return;
        }
        String lower = requested.toLowerCase(Locale.ROOT);
        String contentType = lower.endsWith(".zip") ? "application/zip"
                : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg"
                : lower.endsWith(".png") ? "image/png"
                : lower.endsWith(".tif") || lower.endsWith(".tiff") ? "image/tiff"
                : "application/pdf";
        sendFile(exchange, 200, task.resultPath, task.resultFilename, contentType);
    }

    private void deleteTask(HttpExchange exchange, String taskId) throws IOException {
        Store.Task removed = store.removeTask(taskId);
        if (removed == null) {
            sendJson(exchange, 404, Json.object("error", "unknown task", "id", taskId));
            return;
        }
        sendJson(exchange, 200, Json.object("status", "deleted", "id", taskId));
    }

    private void cancelTask(HttpExchange exchange, String taskId) throws IOException {
        Store.Task task = store.task(taskId);
        if (task == null) {
            sendJson(exchange, 404, Json.object("error", "unknown task", "id", taskId));
            return;
        }
        Future<?> future = task.future;
        if (future != null) {
            future.cancel(true);
        }
        task.status = "Canceled";
        sendJson(exchange, 200, Json.object("status", "Canceled", "id", taskId));
    }

    private void deleteFile(HttpExchange exchange, String fileId) throws IOException {
        Store.StoredFile removed = store.removeFile(fileId);
        if (removed == null) {
            sendJson(exchange, 404, Json.object("error", "unknown file", "id", fileId));
            return;
        }
        sendJson(exchange, 200, Json.object("status", "deleted", "id", fileId));
    }

    private void commonHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Referrer-Policy", "no-referrer");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.getResponseHeaders().set("X-Poc", "reconstructed-backend");
    }

    private byte[] readBody(HttpExchange exchange, int limit) throws IOException {
        try (InputStream in = exchange.getRequestBody()) {
            byte[] data = in.readNBytes(limit + 1);
            if (data.length > limit) {
                throw new IllegalArgumentException("request body exceeds " + limit + " bytes");
            }
            return data;
        }
    }

    private void sendJson(HttpExchange exchange, int status, Object value) throws IOException {
        byte[] bytes = Json.stringify(value).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void sendJsonString(HttpExchange exchange, int status, String value) throws IOException {
        byte[] bytes = Json.stringify(value).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void sendHtml(HttpExchange exchange, int status, String html) throws IOException {
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void sendFile(HttpExchange exchange, int status, Path file, String filename,
                          String contentType) throws IOException {
        long size = Files.size(file);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Content-Disposition",
                "attachment; filename=\"" + filename.replace("\"", "_") + "\"");
        exchange.sendResponseHeaders(status, size);
        try (OutputStream out = exchange.getResponseBody()) {
            Files.copy(file, out);
        }
    }

    private static boolean looksLikePdf(byte[] data) {
        if (data.length < 5) {
            return false;
        }
        return data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' && data[4] == '-';
    }

    private static List<String> pathParts(String path) {
        List<String> parts = new ArrayList<>();
        for (String raw : path.split("/")) {
            if (!raw.isEmpty()) {
                parts.add(decode(raw));
            }
        }
        return parts;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String stringValue(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static String pdfboxVersion() {
        String version = PDDocumentVersion();
        return version == null ? "2.0.x" : version;
    }

    private static String PDDocumentVersion() {
        try {
            Package pkg = org.apache.pdfbox.pdmodel.PDDocument.class.getPackage();
            return pkg == null ? null : pkg.getImplementationVersion();
        } catch (Throwable ignored) {
            return null;
        }
    }

    private String indexHtml() {
        return """
                <!doctype html>
                <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Reconstructed backend PoC</title>
                  <style>
                    body { font: 16px/1.5 system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #16202a; }
                    code, pre { background: #f2f5f7; border-radius: 6px; }
                    code { padding: 2px 5px; }
                    pre { padding: 14px; overflow: auto; }
                    h1 { letter-spacing: -0.02em; }
                    .note { border-left: 4px solid #b45309; padding-left: 14px; color: #5b3a12; }
                  </style>
                </head>
                <body>
                  <h1>Reconstructed backend PoC</h1>
                  <p class="note">Local-only, no authentication, no payment, no production hardening.
                  It is an independent reconstruction, not Sejda's backend, and it does not embed the Sejda SDK.</p>
                  <h2>Endpoints</h2>
                  <pre>GET    /health
                POST   /api/files/upload-check
                POST   /api/files/upload          multipart field "file" or raw application/pdf
                POST   /api/tasks                 JSON: type, files[], step, pages, ...
                GET    /api/tasks/{id}/change
                GET    /api/tasks/{id}/download/{filename}
                POST   /api/tasks/{id}/cancel
                DELETE /api/tasks/{id}
                DELETE /api/files/{id}</pre>
                  <h2>Implemented task types</h2>
                  <ul>
                    <li><code>splitByPages</code> — step grouping or page ranges; multiple outputs become a ZIP</li>
                    <li><code>extractPages</code> — selected pages; one PDF for <code>[BASENAME]</code>, per-range ZIP with a page token</li>
                    <li><code>merge</code> — multiple input files; one PDF</li>
                    <li><code>rotatePages</code> — per-page <code>pageRotationsPerSource</code> or a uniform angle</li>
                    <li><code>splitByBookmarks</code> — outline levels 1–3, optional title filter and extra end page</li>
                    <li><code>splitBySize</code> — approximate greedy KB/MB chunking; not byte-identical to the vendor</li>
                    <li><code>alternateMix</code> — interleave two or more PDFs with per-file step/reverse/repeat</li>
                    <li><code>headerFooter</code> — text header/footer with observed page tokens and fonts</li>
                    <li><code>pdfToImage</code> — JPG/PNG/TIFF at 75/150/220 dpi; ZIP for multiple images</li>
                  </ul>
                  <p>Other public Sejda task types are deliberately not implemented; they return a task failure.</p>
                  <p>Version %s · Java %s · PDFBox %s</p>
                </body>
                </html>
                """.formatted(VERSION, System.getProperty("java.version"), pdfboxVersion());
    }
}
