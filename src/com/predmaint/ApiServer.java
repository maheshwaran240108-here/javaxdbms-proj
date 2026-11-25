package com.predmaint;

import com.predmaint.config.DatabaseConfig;
import com.predmaint.dao.MachineDataDAO;
import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;
import com.predmaint.service.AnomalyDetectorService;
import com.predmaint.service.CSVImporterService;
import com.predmaint.service.MLModelService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import weka.core.Attribute;
import weka.core.Instance;
import weka.core.Instances;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiServer {
    private static final int PORT = 8080;
    private static final String DATASET_PATH = "data/ai4i2020.csv";
    private static final Pattern FIELD_PATTERN = Pattern.compile(
            "\\\"([^\\\"]+)\\\"\\s*:\\s*(\\\"(?:\\\\.|[^\\\"\\\\])*\\\"|[-+]?(?:\\d*\\.)?\\d+(?:[eE][-+]?\\d+)?|true|false|null)");

    private final MachineDataDAO dao = new MachineDataDAO();
    private final MLModelService model = new MLModelService();
    private final AnomalyDetectorService anomalyDetector = new AnomalyDetectorService();

    public static void main(String[] args) throws IOException {
        new ApiServer().start();
    }

    public void start() throws IOException {
        DatabaseConfig.initializeDatabase();
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/", this::handle);
        server.setExecutor(Executors.newFixedThreadPool(4));
        server.start();
        System.out.println("Predictive maintenance API listening at http://localhost:" + PORT);
    }

    private void handle(HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }

        try {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if ("GET".equals(method) && "/api/health".equals(path)) {
                send(exchange, 200, json(map("status", "ok")));
            } else if ("GET".equals(method) && "/api/dashboard".equals(path)) {
                send(exchange, 200, dashboard());
            } else if ("GET".equals(method) && "/api/alerts".equals(path)) {
                send(exchange, 200, alerts());
            } else if ("GET".equals(method) && "/api/dataset".equals(path)) {
                send(exchange, 200, datasetInfo());
            } else if ("POST".equals(method) && "/api/dataset/import".equals(path)) {
                send(exchange, 200, importDataset(exchange));
            } else if ("POST".equals(method) && "/api/predictions".equals(path)) {
                send(exchange, 200, createPrediction(exchange));
            } else if ("GET".equals(method) && "/api/model".equals(path)) {
                send(exchange, 200, json(map("trained", Files.exists(Paths.get("model_artifacts/random_forest.model")),
                        "dataset", DATASET_PATH)));
            } else if ("GET".equals(method) && "/api/settings".equals(path)) {
                send(exchange, 200, json(map("api", "http://localhost:" + PORT,
                        "database", "predictive_maintenance.db", "dataset", DATASET_PATH,
                        "model", "model_artifacts/random_forest.model")));
            } else if ("POST".equals(method) && "/api/model/train".equals(path)) {
                send(exchange, 200, trainModel());
            } else if ("POST".equals(method) && "/api/model/evaluate".equals(path)) {
                send(exchange, 200, evaluateModel());
            } else if ("GET".equals(method) && "/api/reports".equals(path)) {
                send(exchange, 200, reports());
            } else if ("GET".equals(method) && "/api/reports/export".equals(path)) {
                sendText(exchange, 200, reportCsv(), "text/csv; charset=utf-8");
            } else {
                send(exchange, 404, json(map("error", "API endpoint not found")));
            }
        } catch (IllegalArgumentException ex) {
            send(exchange, 400, json(map("error", ex.getMessage())));
        } catch (Exception ex) {
            String message = ex.getMessage() == null ? "Request failed" : ex.getMessage();
            send(exchange, 500, json(map("error", message)));
        }
    }

    private String dashboard() throws SQLException {
        int[] stats = dao.getDashboardStats();
        int[] risks = dao.getRiskDistribution();
        List<Map<String, Object>> predictions = new ArrayList<>();
        for (String[] row : dao.getRecentPredictions()) {
            predictions.add(map("time", row[0], "machineId", row[1], "risk", row[2],
                    "failureProbability", row[3], "assessment", row[4]));
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (String[] row : dao.getReadingsTrend()) {
            trend.add(map("date", row[0], "readings", Integer.parseInt(row[1])));
        }
        return json(map("stats", map("readings", stats[0], "normal", risks[0],
                        "atRisk", risks[1] + risks[2], "predictedFailures", risks[2], "highRisk", stats[1],
                        "openAlerts", stats[2]),
                "riskDistribution", map("low", risks[0], "medium", risks[1], "high", risks[2]),
                "readingsTrend", trend, "predictions", predictions));
    }

    private String datasetInfo() throws Exception {
        Instances data = CSVImporterService.loadDataset(DATASET_PATH);
        return json(map("filename", Paths.get(DATASET_PATH).getFileName().toString(),
                "path", DATASET_PATH, "rows", data.numInstances(), "columns", data.numAttributes(),
                "headers", headers(data), "preview", preview(data)));
    }

    private String importDataset(HttpExchange exchange) throws Exception {
        byte[] content = exchange.getRequestBody().readAllBytes();
        if (content.length == 0) throw new IllegalArgumentException("Choose a non-empty CSV file.");
        if (content.length > 25 * 1024 * 1024) throw new IllegalArgumentException("CSV file must be smaller than 25 MB.");

        Path destination = Paths.get(DATASET_PATH);
        Files.createDirectories(destination.getParent());
        Instances data;
        try {
            data = CSVImporterService.loadDataset(new ByteArrayInputStream(content));
        } catch (IOException ex) {
            throw new IllegalArgumentException("The uploaded file could not be parsed as CSV.", ex);
        }
        int productId = findColumn(data, "Product ID", "Machine ID", "UDI");
        int airTemp = findColumn(data, "Air temperature");
        int processTemp = findColumn(data, "Process temperature");
        int speed = findColumn(data, "Rotational speed");
        int torque = findColumn(data, "Torque");
        int wear = findColumn(data, "Tool wear");
        List<MachineReading> readings = new ArrayList<>();
        for (Instance row : data) {
            readings.add(new MachineReading(cell(row, productId), row.value(airTemp), row.value(processTemp),
                    row.value(speed), row.value(torque), row.value(wear)));
        }

        Path temporary = Files.createTempFile(destination.getParent(), "ai4i2020-", ".upload");
        try {
            Files.write(temporary, content);
            int imported = dao.saveReadings(readings);
            Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
            return json(map("filename", destination.getFileName().toString(), "path", DATASET_PATH,
                    "rows", data.numInstances(), "importedRecords", imported, "columns", data.numAttributes(),
                    "headers", headers(data), "preview", preview(data)));
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private String reports() throws Exception {
        int[] stats = dao.getDashboardStats();
        int[] risks = dao.getRiskDistribution();
        Map<String, Object> metrics = null;
        if (Files.exists(Paths.get("model_artifacts/random_forest.model"))) {
            synchronized (model) {
                metrics = model.evaluateModelMetrics(CSVImporterService.loadDataset(DATASET_PATH));
            }
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (String[] row : dao.getReadingsTrend()) {
            trend.add(map("date", row[0], "readings", Integer.parseInt(row[1])));
        }
        return json(map("stats", map("readings", stats[0], "normal", risks[0], "atRisk", risks[1] + risks[2],
                        "predictedFailures", risks[2], "openAlerts", stats[2]),
                "riskDistribution", map("low", risks[0], "medium", risks[1], "high", risks[2]),
                "readingsTrend", trend, "modelMetrics", metrics));
    }

    private String reportCsv() throws SQLException {
        int[] stats = dao.getDashboardStats();
        int[] risks = dao.getRiskDistribution();
        return "metric,value\nTotal machine readings," + stats[0] + "\nNormal predictions," + risks[0] +
                "\nMedium-risk predictions," + risks[1] + "\nPredicted failures," + risks[2] +
                "\nOpen alerts," + stats[2] + "\n";
    }

    private static List<String> headers(Instances data) {
        List<String> headers = new ArrayList<>();
        for (int i = 0; i < data.numAttributes(); i++) headers.add(data.attribute(i).name());
        return headers;
    }

    private static List<Map<String, String>> preview(Instances data) {
        List<Map<String, String>> rows = new ArrayList<>();
        int limit = Math.min(6, data.numInstances());
        for (int rowIndex = 0; rowIndex < limit; rowIndex++) {
            Instance row = data.instance(rowIndex);
            Map<String, String> values = new LinkedHashMap<>();
            for (int column = 0; column < data.numAttributes(); column++) {
                values.put(data.attribute(column).name(), cell(row, column));
            }
            rows.add(values);
        }
        return rows;
    }

    private static int findColumn(Instances data, String... names) {
        for (String candidate : names) {
            for (int i = 0; i < data.numAttributes(); i++) {
                String actual = data.attribute(i).name().toLowerCase();
                if (actual.startsWith(candidate.toLowerCase())) return i;
            }
        }
        throw new IllegalArgumentException("CSV is missing required column: " + names[0]);
    }

    private static String cell(Instance row, int column) {
        Attribute attribute = row.attribute(column);
        if (attribute.isNominal() || attribute.isString()) return row.stringValue(column);
        double value = row.value(column);
        return value == Math.rint(value) ? Long.toString((long) value) : Double.toString(value);
    }

    private String alerts() throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String[] row : dao.getAlerts()) {
            rows.add(map("time", row[0], "machineId", row[1], "type", row[2],
                    "status", row[3], "message", row[4]));
        }
        return json(rows);
    }

    private String createPrediction(HttpExchange exchange) throws Exception {
        Map<String, String> fields = parseFields(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        String machineId = required(fields, "machineId").trim();
        if (machineId.isEmpty()) throw new IllegalArgumentException("Machine ID is required.");

        MachineReading reading = new MachineReading(machineId,
                number(fields, "airTemp"), number(fields, "processTemp"),
                number(fields, "rotationalSpeed"), number(fields, "torque"), number(fields, "toolWear"));
        int readingId = dao.saveReading(reading);
        List<String> anomalies = anomalyDetector.inspectReading(readingId, reading);
        PredictionResult result;
        synchronized (model) {
            result = model.predict(readingId, reading);
        }
        dao.savePrediction(result);
        if ("HIGH".equals(result.getRiskCategory())) {
            dao.saveAlert(readingId, "HIGH_RISK", "Predicted failure probability exceeds threshold");
        }

        return json(map("machineId", machineId, "risk", result.getRiskCategory(),
                "failureProbability", result.getFailureProbability(), "assessment", result.getPrediction(),
                "anomalies", anomalies));
    }

    private String trainModel() throws Exception {
        Instances data = CSVImporterService.loadDataset(DATASET_PATH);
        synchronized (model) {
            model.trainModel(data);
        }
        return json(map("message", "Random forest training completed", "rows", data.numInstances()));
    }

    private String evaluateModel() throws Exception {
        Instances data = CSVImporterService.loadDataset(DATASET_PATH);
        Map<String, Object> metrics;
        synchronized (model) {
            metrics = model.evaluateModelMetrics(data);
        }
        return json(metrics);
    }

    private static Map<String, String> parseFields(String body) {
        Map<String, String> fields = new LinkedHashMap<>();
        Matcher matcher = FIELD_PATTERN.matcher(body);
        while (matcher.find()) {
            String value = matcher.group(2);
            if (value.startsWith("\"")) value = unescape(value.substring(1, value.length() - 1));
            fields.put(matcher.group(1), value);
        }
        return fields;
    }

    private static String unescape(String value) {
        return value.replace("\\\"", "\"").replace("\\\\", "\\")
                .replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t");
    }

    private static String required(Map<String, String> fields, String name) {
        String value = fields.get(name);
        if (value == null) throw new IllegalArgumentException("Missing field: " + name);
        return value;
    }

    private static double number(Map<String, String> fields, String name) {
        try {
            double value = Double.parseDouble(required(fields, name));
            if (Double.isNaN(value) || Double.isInfinite(value)) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(name + " must be a finite number.");
        }
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }

    private static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return "\"" + escape((String) value) + "\"";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map) {
            StringBuilder output = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                if (!first) output.append(',');
                output.append(json(entry.getKey().toString())).append(':').append(json(entry.getValue()));
                first = false;
            }
            return output.append('}').toString();
        }
        if (value instanceof Iterable) {
            StringBuilder output = new StringBuilder("[");
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) output.append(',');
                output.append(json(item));
                first = false;
            }
            return output.append(']').toString();
        }
        return json(value.toString());
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        sendText(exchange, status, body, "application/json; charset=utf-8");
    }

    private static void sendText(HttpExchange exchange, int status, String body, String contentType) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}