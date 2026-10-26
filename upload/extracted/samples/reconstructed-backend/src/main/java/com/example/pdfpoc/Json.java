package com.example.pdfpoc;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal JSON reader/writer for the PoC.
 *
 * <p>This is deliberately small: it supports objects, arrays, strings,
 * numbers, booleans and null. It is not a general-purpose JSON library and
 * should not be used outside this local PoC.</p>
 */
public final class Json {
    private Json() {
    }

    public static Object parse(String text) {
        Parser parser = new Parser(text);
        Object value = parser.value();
        parser.ws();
        if (!parser.eof()) {
            throw new IllegalArgumentException("Trailing JSON at offset " + parser.i);
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String text) {
        Object value = parse(text);
        if (!(value instanceof Map)) {
            throw new IllegalArgumentException("Expected JSON object");
        }
        return (Map<String, Object>) value;
    }

    public static String stringify(Object value) {
        StringBuilder out = new StringBuilder();
        write(value, out);
        return out.toString();
    }

    public static Map<String, Object> object(Object... pairs) {
        if (pairs.length % 2 != 0) {
            throw new IllegalArgumentException("object() needs key/value pairs");
        }
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private static void write(Object value, StringBuilder out) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof String) {
            quote((String) value, out);
        } else if (value instanceof Number || value instanceof Boolean) {
            out.append(value);
        } else if (value instanceof Map) {
            out.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> entry : ((Map<String, Object>) value).entrySet()) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                quote(entry.getKey(), out);
                out.append(':');
                write(entry.getValue(), out);
            }
            out.append('}');
        } else if (value instanceof Iterable) {
            out.append('[');
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                write(item, out);
            }
            out.append(']');
        } else if (value.getClass().isArray()) {
            out.append('[');
            int length = java.lang.reflect.Array.getLength(value);
            for (int i = 0; i < length; i++) {
                if (i > 0) {
                    out.append(',');
                }
                write(java.lang.reflect.Array.get(value, i), out);
            }
            out.append(']');
        } else {
            quote(String.valueOf(value), out);
        }
    }

    private static void quote(String value, StringBuilder out) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }

    private static final class Parser {
        private final String text;
        private int i;

        private Parser(String text) {
            this.text = text == null ? "" : text;
        }

        private boolean eof() {
            return i >= text.length();
        }

        private void ws() {
            while (!eof()) {
                char c = text.charAt(i);
                if (c == ' ' || c == '\n' || c == '\r' || c == '\t') {
                    i++;
                } else {
                    break;
                }
            }
        }

        private char peek() {
            if (eof()) {
                throw new IllegalArgumentException("Unexpected end of JSON");
            }
            return text.charAt(i);
        }

        private void expect(char expected) {
            if (eof() || text.charAt(i) != expected) {
                throw new IllegalArgumentException("Expected '" + expected + "' at offset " + i);
            }
            i++;
        }

        private Object value() {
            ws();
            char c = peek();
            if (c == '{') {
                return object();
            }
            if (c == '[') {
                return array();
            }
            if (c == '"') {
                return string();
            }
            if (c == 't' && text.startsWith("true", i)) {
                i += 4;
                return Boolean.TRUE;
            }
            if (c == 'f' && text.startsWith("false", i)) {
                i += 5;
                return Boolean.FALSE;
            }
            if (c == 'n' && text.startsWith("null", i)) {
                i += 4;
                return null;
            }
            return number();
        }

        private Map<String, Object> object() {
            expect('{');
            Map<String, Object> map = new LinkedHashMap<>();
            ws();
            if (!eof() && peek() == '}') {
                i++;
                return map;
            }
            while (true) {
                ws();
                String key = string();
                ws();
                expect(':');
                Object value = value();
                map.put(key, value);
                ws();
                if (eof()) {
                    throw new IllegalArgumentException("Unterminated JSON object");
                }
                char c = text.charAt(i++);
                if (c == '}') {
                    return map;
                }
                if (c != ',') {
                    throw new IllegalArgumentException("Expected ',' or '}' at offset " + (i - 1));
                }
            }
        }

        private List<Object> array() {
            expect('[');
            List<Object> list = new ArrayList<>();
            ws();
            if (!eof() && peek() == ']') {
                i++;
                return list;
            }
            while (true) {
                list.add(value());
                ws();
                if (eof()) {
                    throw new IllegalArgumentException("Unterminated JSON array");
                }
                char c = text.charAt(i++);
                if (c == ']') {
                    return list;
                }
                if (c != ',') {
                    throw new IllegalArgumentException("Expected ',' or ']' at offset " + (i - 1));
                }
            }
        }

        private String string() {
            expect('"');
            StringBuilder out = new StringBuilder();
            while (!eof()) {
                char c = text.charAt(i++);
                if (c == '"') {
                    return out.toString();
                }
                if (c != '\\') {
                    out.append(c);
                    continue;
                }
                if (eof()) {
                    throw new IllegalArgumentException("Unterminated escape");
                }
                char e = text.charAt(i++);
                switch (e) {
                    case '"' -> out.append('"');
                    case '\\' -> out.append('\\');
                    case '/' -> out.append('/');
                    case 'b' -> out.append('\b');
                    case 'f' -> out.append('\f');
                    case 'n' -> out.append('\n');
                    case 'r' -> out.append('\r');
                    case 't' -> out.append('\t');
                    case 'u' -> {
                        if (i + 4 > text.length()) {
                            throw new IllegalArgumentException("Bad unicode escape");
                        }
                        String hex = text.substring(i, i + 4);
                        i += 4;
                        out.append((char) Integer.parseInt(hex, 16));
                    }
                    default -> throw new IllegalArgumentException("Bad escape \\" + e);
                }
            }
            throw new IllegalArgumentException("Unterminated string");
        }

        private Number number() {
            int start = i;
            if (!eof() && (peek() == '-' || peek() == '+')) {
                i++;
            }
            while (!eof() && Character.isDigit(text.charAt(i))) {
                i++;
            }
            boolean fractional = false;
            if (!eof() && text.charAt(i) == '.') {
                fractional = true;
                i++;
                while (!eof() && Character.isDigit(text.charAt(i))) {
                    i++;
                }
            }
            if (!eof() && (text.charAt(i) == 'e' || text.charAt(i) == 'E')) {
                fractional = true;
                i++;
                if (!eof() && (text.charAt(i) == '-' || text.charAt(i) == '+')) {
                    i++;
                }
                while (!eof() && Character.isDigit(text.charAt(i))) {
                    i++;
                }
            }
            if (start == i) {
                throw new IllegalArgumentException("Expected JSON value at offset " + i);
            }
            String token = text.substring(start, i);
            if (fractional) {
                return Double.parseDouble(token);
            }
            try {
                return Long.parseLong(token);
            } catch (NumberFormatException e) {
                return Double.parseDouble(token);
            }
        }
    }
}
