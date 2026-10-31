package com.predmaint.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public class DatabaseConfig {
    private static final String DB_URL = "jdbc:sqlite:predictive_maintenance.db";

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initializeDatabase() {
        String sqlReadings = "CREATE TABLE IF NOT EXISTS machine_readings (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id TEXT, air_temp REAL, " +
                "process_temp REAL, rotational_speed REAL, torque REAL, tool_wear REAL, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";

        String sqlPredictions = "CREATE TABLE IF NOT EXISTS prediction_results (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, reading_id INTEGER, " +
                "failure_probability REAL, prediction TEXT, risk_category TEXT, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";

        String sqlAlerts = "CREATE TABLE IF NOT EXISTS maintenance_alerts (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, reading_id INTEGER, " +
                "alert_type TEXT, message TEXT, status TEXT DEFAULT 'OPEN', " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);";

        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute(sqlReadings);
            stmt.execute(sqlPredictions);
            stmt.execute(sqlAlerts);
        } catch (SQLException e) {
            System.err.println("Database initialization error: " + e.getMessage());
        }
    }
}