package com.predmaint.dao;

import com.predmaint.config.DatabaseConfig;
import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class MachineDataDAO {

    public int[] getDashboardStats() throws SQLException {
        int[] stats = new int[3];
        String[] queries = {
                "SELECT COUNT(*) FROM machine_readings",
                "SELECT COUNT(*) FROM prediction_results WHERE risk_category='HIGH'",
                "SELECT COUNT(*) FROM maintenance_alerts WHERE status='OPEN'"
        };

        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            for (int i = 0; i < queries.length; i++) {
                try (ResultSet rs = stmt.executeQuery(queries[i])) {
                    if (rs.next()) {
                        stats[i] = rs.getInt(1);
                    }
                }
            }
        }
        return stats;
    }

    public int[] getRiskDistribution() throws SQLException {
        String sql = "SELECT " +
                "SUM(CASE WHEN risk_category='LOW' THEN 1 ELSE 0 END), " +
                "SUM(CASE WHEN risk_category='MEDIUM' THEN 1 ELSE 0 END), " +
                "SUM(CASE WHEN risk_category='HIGH' THEN 1 ELSE 0 END) " +
                "FROM prediction_results";
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) return new int[]{rs.getInt(1), rs.getInt(2), rs.getInt(3)};
        }
        return new int[3];
    }

    public List<String[]> getReadingsTrend() throws SQLException {
        String sql = "SELECT DATE(created_at) AS reading_date, COUNT(*) AS reading_count " +
                "FROM machine_readings GROUP BY DATE(created_at) " +
                "ORDER BY DATE(created_at) DESC LIMIT 8";
        List<String[]> rows = new ArrayList<>();
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) rows.add(new String[]{rs.getString("reading_date"), rs.getString("reading_count")});
        }
        java.util.Collections.reverse(rows);
        return rows;
    }

    public int saveReadings(List<MachineReading> readings) throws SQLException {
        String sql = "INSERT INTO machine_readings(machine_id, air_temp, process_temp, rotational_speed, torque, tool_wear) VALUES(?,?,?,?,?,?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement statement = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            try {
                for (MachineReading reading : readings) {
                    statement.setString(1, reading.getMachineId());
                    statement.setDouble(2, reading.getAirTemp());
                    statement.setDouble(3, reading.getProcessTemp());
                    statement.setDouble(4, reading.getRotationalSpeed());
                    statement.setDouble(5, reading.getTorque());
                    statement.setDouble(6, reading.getToolWear());
                    statement.addBatch();
                }
                statement.executeBatch();
                conn.commit();
                return readings.size();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            }
        }
    }

    public List<String[]> getRecentPredictions() throws SQLException {
        String sql = "SELECT r.created_at, r.machine_id, p.risk_category, " +
                "p.failure_probability, p.prediction FROM prediction_results p " +
                "JOIN machine_readings r ON p.reading_id=r.id " +
                "ORDER BY p.id DESC LIMIT 8";
        List<String[]> rows = new ArrayList<>();

        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("created_at"),
                        rs.getString("machine_id"),
                        rs.getString("risk_category"),
                        String.format("%.1f%%", rs.getDouble("failure_probability")),
                        rs.getString("prediction")
                });
            }
        }
        return rows;
    }

    public List<String[]> getAlerts() throws SQLException {
        String sql = "SELECT a.created_at, r.machine_id, a.alert_type, a.status, a.message " +
                "FROM maintenance_alerts a JOIN machine_readings r ON a.reading_id=r.id " +
                "ORDER BY a.id DESC";
        List<String[]> rows = new ArrayList<>();

        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("created_at"),
                        rs.getString("machine_id"),
                        rs.getString("alert_type"),
                        rs.getString("status"),
                        rs.getString("message")
                });
            }
        }
        return rows;
    }

    public int saveReading(MachineReading r) throws SQLException {
        String sql = "INSERT INTO machine_readings(machine_id, air_temp, process_temp, rotational_speed, torque, tool_wear) VALUES(?,?,?,?,?,?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setString(1, r.getMachineId());
            pstmt.setDouble(2, r.getAirTemp());
            pstmt.setDouble(3, r.getProcessTemp());
            pstmt.setDouble(4, r.getRotationalSpeed());
            pstmt.setDouble(5, r.getTorque());
            pstmt.setDouble(6, r.getToolWear());
            pstmt.executeUpdate();

            ResultSet rs = pstmt.getGeneratedKeys();
            if (rs.next()) {
                return rs.getInt(1);
            }
        }
        return -1;
    }

    public void savePrediction(PredictionResult p) throws SQLException {
        String sql = "INSERT INTO prediction_results(reading_id, failure_probability, prediction, risk_category) VALUES(?,?,?,?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, p.getReadingId());
            pstmt.setDouble(2, p.getFailureProbability());
            pstmt.setString(3, p.getPrediction());
            pstmt.setString(4, p.getRiskCategory());
            pstmt.executeUpdate();
        }
    }

    public void saveAlert(int readingId, String alertType, String message) throws SQLException {
        String sql = "INSERT INTO maintenance_alerts(reading_id, alert_type, message) VALUES(?,?,?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, readingId);
            pstmt.setString(2, alertType);
            pstmt.setString(3, message);
            pstmt.executeUpdate();
        }
    }

    public List<String[]> getMachineReportSummaries() throws SQLException {
        String sql = "SELECT r.machine_id, COUNT(r.id) AS reading_count, " +
                "latest.air_temp, latest.process_temp, latest.rotational_speed, latest.torque, latest.tool_wear, latest.created_at, " +
                "p.failure_probability, p.prediction, p.risk_category, " +
                "(SELECT COUNT(*) FROM maintenance_alerts a2 JOIN machine_readings r2 ON a2.reading_id = r2.id WHERE r2.machine_id = r.machine_id AND a2.status = 'OPEN') AS open_alerts, " +
                "(SELECT COUNT(*) FROM maintenance_alerts a3 JOIN machine_readings r3 ON a3.reading_id = r3.id WHERE r3.machine_id = r.machine_id) AS total_alerts, " +
                "(SELECT a4.message FROM maintenance_alerts a4 JOIN machine_readings r4 ON a4.reading_id = r4.id WHERE r4.machine_id = r.machine_id ORDER BY a4.id DESC LIMIT 1) AS latest_alert " +
                "FROM machine_readings r " +
                "JOIN machine_readings latest ON latest.id = (SELECT MAX(id) FROM machine_readings WHERE machine_id = r.machine_id) " +
                "LEFT JOIN prediction_results p ON p.id = (SELECT MAX(id) FROM prediction_results WHERE reading_id = latest.id) " +
                "GROUP BY r.machine_id " +
                "ORDER BY latest.id DESC LIMIT 50";
        List<String[]> rows = new ArrayList<>();
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("machine_id"),
                        Integer.toString(rs.getInt("reading_count")),
                        Double.toString(rs.getDouble("air_temp")),
                        Double.toString(rs.getDouble("process_temp")),
                        Double.toString(rs.getDouble("rotational_speed")),
                        Double.toString(rs.getDouble("torque")),
                        Double.toString(rs.getDouble("tool_wear")),
                        rs.getString("created_at"),
                        rs.getObject("failure_probability") == null ? "" : String.format("%.1f", rs.getDouble("failure_probability")),
                        rs.getString("prediction") == null ? "" : rs.getString("prediction"),
                        rs.getString("risk_category") == null ? "" : rs.getString("risk_category"),
                        Integer.toString(rs.getInt("open_alerts")),
                        Integer.toString(rs.getInt("total_alerts")),
                        rs.getString("latest_alert") == null ? "" : rs.getString("latest_alert")
                });
            }
        }
        return rows;
    }
}