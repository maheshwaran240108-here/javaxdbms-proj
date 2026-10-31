package com.predmaint.dao;

import com.predmaint.config.DatabaseConfig;
import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;

import java.sql.*;

public class MachineDataDAO {

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
}