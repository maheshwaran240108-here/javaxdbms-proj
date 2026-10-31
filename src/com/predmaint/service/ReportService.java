package com.predmaint.service;

import com.predmaint.config.DatabaseConfig;

import java.sql.*;

public class ReportService {

    public void generateSummaryReport() throws SQLException {
        String queryReadings = "SELECT COUNT(*) FROM machine_readings;";
        String queryFailures = "SELECT COUNT(*) FROM prediction_results WHERE risk_category='HIGH';";
        String queryAlerts = "SELECT COUNT(*) FROM maintenance_alerts;";

        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {

            ResultSet rs1 = stmt.executeQuery(queryReadings);
            int totalReadings = rs1.next() ? rs1.getInt(1) : 0;

            ResultSet rs2 = stmt.executeQuery(queryFailures);
            int totalFailures = rs2.next() ? rs2.getInt(1) : 0;

            ResultSet rs3 = stmt.executeQuery(queryAlerts);
            int totalAlerts = rs3.next() ? rs3.getInt(1) : 0;

            System.out.println("===========================================");
            System.out.println("        SYSTEM SUMMARY REPORT              ");
            System.out.println("===========================================");
            System.out.println("Total Readings Processed : " + totalReadings);
            System.out.println("Predicted High Failure Risk: " + totalFailures);
            System.out.println("Total Anomalies/Alerts   : " + totalAlerts);
            System.out.println("===========================================");
        }
    }

    public void displayAlerts() throws SQLException {
        String query = "SELECT a.id, r.machine_id, a.alert_type, a.message, a.status, a.created_at " +
                       "FROM maintenance_alerts a JOIN machine_readings r ON a.reading_id = r.id;";

        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {

            System.out.println("==========================================================================");
            System.out.println("ID  | Machine ID | Type     | Status | Date                | Message");
            System.out.println("--------------------------------------------------------------------------");
            while (rs.next()) {
                System.out.printf("%-3d | %-10s | %-8s | %-6s | %-19s | %s\n",
                        rs.getInt("id"), rs.getString("machine_id"),
                        rs.getString("alert_type"), rs.getString("status"),
                        rs.getString("created_at"), rs.getString("message"));
            }
            System.out.println("==========================================================================");
        }
    }
}