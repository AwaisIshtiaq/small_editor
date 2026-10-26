package com.example.pdfpoc;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Minimal multipart/form-data parser for one file field. */
public final class Multipart {
    private Multipart() {
    }

    public static Map<String, Part> parse(byte[] body, String contentType) throws IOException {
        String boundary = boundary(contentType);
        byte[] delimiter = ("--" + boundary).getBytes(StandardCharsets.ISO_8859_1);
        Map<String, Part> parts = new LinkedHashMap<>();
        int position = indexOf(body, delimiter, 0);
        if (position < 0) {
            throw new IOException("Multipart boundary not found");
        }
        while (position >= 0) {
            int afterDelimiter = position + delimiter.length;
            if (afterDelimiter + 1 < body.length
                    && body[afterDelimiter] == '-' && body[afterDelimiter + 1] == '-') {
                break;
            }
            if (afterDelimiter + 1 < body.length
                    && body[afterDelimiter] == '\r' && body[afterDelimiter + 1] == '\n') {
                afterDelimiter += 2;
            }
            int headersEnd = indexOf(body, "\r\n\r\n".getBytes(StandardCharsets.ISO_8859_1), afterDelimiter);
            if (headersEnd < 0) {
                break;
            }
            String headers = new String(body, afterDelimiter, headersEnd - afterDelimiter, StandardCharsets.ISO_8859_1);
            int dataStart = headersEnd + 4;
            int next = indexOf(body, delimiter, dataStart);
            if (next < 0) {
                break;
            }
            int dataEnd = next;
            if (dataEnd >= 2 && body[dataEnd - 2] == '\r' && body[dataEnd - 1] == '\n') {
                dataEnd -= 2;
            }
            Part part = parsePart(headers, java.util.Arrays.copyOfRange(body, dataStart, dataEnd));
            if (part.name != null) {
                parts.put(part.name, part);
            }
            position = next;
        }
        return parts;
    }

    private static String boundary(String contentType) throws IOException {
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("multipart/form-data")) {
            throw new IOException("Not multipart/form-data");
        }
        for (String item : contentType.split(";")) {
            String trimmed = item.trim();
            if (trimmed.toLowerCase(Locale.ROOT).startsWith("boundary=")) {
                String value = trimmed.substring("boundary=".length()).trim();
                if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
                    value = value.substring(1, value.length() - 1);
                }
                if (!value.isEmpty()) {
                    return value;
                }
            }
        }
        throw new IOException("Missing multipart boundary");
    }

    private static Part parsePart(String headers, byte[] data) {
        Part part = new Part();
        part.data = data;
        for (String line : headers.split("\r\n")) {
            int colon = line.indexOf(':');
            if (colon < 0) {
                continue;
            }
            String name = line.substring(0, colon).trim();
            String value = line.substring(colon + 1).trim();
            if (name.equalsIgnoreCase("Content-Disposition")) {
                part.name = parameter(value, "name");
                part.filename = parameter(value, "filename");
            } else if (name.equalsIgnoreCase("Content-Type")) {
                part.contentType = value;
            }
        }
        return part;
    }

    private static String parameter(String header, String key) {
        for (String item : header.split(";")) {
            String trimmed = item.trim();
            int equals = trimmed.indexOf('=');
            if (equals < 0) {
                continue;
            }
            if (!trimmed.substring(0, equals).trim().equalsIgnoreCase(key)) {
                continue;
            }
            String value = trimmed.substring(equals + 1).trim();
            if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
                value = value.substring(1, value.length() - 1);
            }
            return value;
        }
        return null;
    }

    private static int indexOf(byte[] haystack, byte[] needle, int from) {
        if (needle.length == 0) {
            return from;
        }
        int limit = haystack.length - needle.length;
        outer:
        for (int i = Math.max(0, from); i <= limit; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    continue outer;
                }
            }
            return i;
        }
        return -1;
    }

    public static final class Part {
        public String name;
        public String filename;
        public String contentType;
        public byte[] data;

        public int size() {
            return data == null ? 0 : data.length;
        }

        public byte[] bytes() {
            return data;
        }

        public String text() {
            return data == null ? "" : new String(data, StandardCharsets.UTF_8);
        }
    }
}
