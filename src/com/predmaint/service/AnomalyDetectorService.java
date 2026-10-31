package com.predmaint.service;

import com.predmaint.dao.MachineDataDAO;
import com.predmaint.model.MachineReading;

import java.util.ArrayList;
import java.util.List;

public class AnomalyDetectorService {
    private MachineDataDAO dao = new MachineDataDAO();

    public List<String> inspectReading(int readingId, MachineReading r) throws Exception {
        List<String> anomalies = new ArrayList<>();

        if (r.getAirTemp() > 305.0) {
            anomalies.add("High Air Temperature Alert (" + r.getAirTemp() + " K)");
        }
        if (r.getRotationalSpeed() < 1200 || r.getRotationalSpeed() > 2800) {
            anomalies.add("Abnormal Rotational Speed (" + r.getRotationalSpeed() + " RPM)");
        }
        if (r.getTorque() > 65.0) {
            anomalies.add("Excessive Torque (" + r.getTorque() + " Nm)");
        }
        if (r.getToolWear() > 200) {
            anomalies.add("Critical Tool Wear Level (" + r.getToolWear() + " mins)");
        }

        for (String message : anomalies) {
            dao.saveAlert(readingId, "ANOMALY", message);
        }

        return anomalies;
    }
}