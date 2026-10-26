package com.example.pdfpoc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory metadata plus a private temporary directory. */
public final class Store {
    public static final class StoredFile {
        public final String id;
        public final String originalName;
        public final Path path;
        public final long bytes;
        public final Instant createdAt;

        StoredFile(String id, String originalName, Path path, long bytes) {
            this.id = id;
            this.originalName = originalName;
            this.path = path;
            this.bytes = bytes;
            this.createdAt = Instant.now();
        }
    }

    public static final class Task {
        public final String id;
        public final String type;
        public final List<String> fileIds;
        public final Instant createdAt = Instant.now();
        public volatile String status = "Processing";
        public volatile String resultFilename;
        public volatile Path resultPath;
        public volatile long resultBytes;
        public volatile List<String> resultItems = new ArrayList<>();
        public volatile List<String> warnings = new ArrayList<>();
        public volatile String error;
        public volatile Future<?> future;
        public volatile Instant completedAt;

        Task(String id, String type, List<String> fileIds) {
            this.id = id;
            this.type = type;
            this.fileIds = List.copyOf(fileIds);
        }
    }

    private final Path root;
    private final Path filesDir;
    private final Path resultsDir;
    private final Map<String, StoredFile> files = new ConcurrentHashMap<>();
    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private final AtomicLong counter = new AtomicLong();

    public Store() throws IOException {
        this.root = Files.createTempDirectory("pdfpoc-");
        this.filesDir = Files.createDirectories(root.resolve("files"));
        this.resultsDir = Files.createDirectories(root.resolve("results"));
    }

    public Path root() {
        return root;
    }

    public StoredFile putFile(String originalName, byte[] data) throws IOException {
        String id = UUID.randomUUID() + "-POC_" + counter.incrementAndGet();
        String safeName = originalName == null ? "upload.pdf" : Path.of(originalName).getFileName().toString();
        Path path = filesDir.resolve(id + ".pdf");
        Files.write(path, data);
        StoredFile stored = new StoredFile(id, safeName, path, data.length);
        files.put(id, stored);
        return stored;
    }

    public StoredFile file(String id) {
        return files.get(id);
    }

    public StoredFile removeFile(String id) {
        StoredFile stored = files.remove(id);
        if (stored != null) {
            try {
                Files.deleteIfExists(stored.path);
            } catch (IOException ignored) {
                // best effort
            }
        }
        return stored;
    }

    public Task createTask(String type, List<String> fileIds) {
        String id = "POC-" + Long.toHexString(System.currentTimeMillis()).toUpperCase() + "-" + counter.incrementAndGet();
        Task task = new Task(id, type, new ArrayList<>(fileIds));
        tasks.put(id, task);
        return task;
    }

    public Task task(String id) {
        return tasks.get(id);
    }

    public Task removeTask(String id) {
        Task task = tasks.remove(id);
        if (task != null) {
            Future<?> future = task.future;
            if (future != null) {
                future.cancel(true);
            }
            if (task.resultPath != null) {
                try {
                    Files.deleteIfExists(task.resultPath);
                } catch (IOException ignored) {
                    // best effort
                }
            }
        }
        return task;
    }

    public Path resultsDir() {
        return resultsDir;
    }

    public void cleanup() {
        try {
            if (root != null && Files.exists(root)) {
                try (var walk = Files.walk(root)) {
                    walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // best effort
                        }
                    });
                }
            }
        } catch (IOException ignored) {
            // best effort
        }
    }
}
