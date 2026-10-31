package com.predmaint;

import com.predmaint.config.DatabaseConfig;
import com.predmaint.dao.MachineDataDAO;
import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;
import com.predmaint.service.*;
import weka.core.Instances;

import java.util.List;
import java.util.Scanner;

public class Main {
    private static MLModelService mlService = new MLModelService();
    private static MachineDataDAO dao = new MachineDataDAO();
    private static AnomalyDetectorService anomalyDetector = new AnomalyDetectorService();
    private static ReportService reportService = new ReportService();

    public static void main(String[] args) {
        DatabaseConfig.initializeDatabase();
        Scanner scanner = new Scanner(System.in);

        while (true) {
            System.out.println("\n===========================================");
            System.out.println("   PREDICTIVE MAINTENANCE SYSTEM");
            System.out.println("===========================================");
            System.out.println("1. Import Historical Dataset");
            System.out.println("2. Train Machine Learning Model");
            System.out.println("3. Evaluate Model Performance");
            System.out.println("4. Enter New Machine Reading & Predict");
            System.out.println("5. View Maintenance Alerts");
            System.out.println("6. Generate Performance Reports");
            System.out.println("7. Exit");
            System.out.print("Enter your choice: ");

            int choice = scanner.nextInt();
            scanner.nextLine(); 

            try {
                switch (choice) {
                    case 1:
                        System.out.print("Enter dataset path (e.g., data/ai4i2020.csv): ");
                        String path = scanner.nextLine();
                        Instances dataset = CSVImporterService.loadDataset(path);
                        System.out.println("Dataset imported successfully! Instances: " + dataset.numInstances());
                        break;
                    case 2:
                        System.out.print("Enter dataset path for training: ");
                        String trainPath = scanner.nextLine();
                        Instances trainData = CSVImporterService.loadDataset(trainPath);
                        mlService.trainModel(trainData);
                        break;
                    case 3:
                        System.out.print("Enter dataset path for evaluation: ");
                        String evalPath = scanner.nextLine();
                        Instances evalData = CSVImporterService.loadDataset(evalPath);
                        mlService.evaluateModel(evalData);
                        break;
                    case 4:
                        System.out.print("Enter Machine ID: ");
                        String mId = scanner.nextLine();
                        System.out.print("Air Temperature (K): ");
                        double air = scanner.nextDouble();
                        System.out.print("Process Temperature (K): ");
                        double proc = scanner.nextDouble();
                        System.out.print("Rotational Speed (RPM): ");
                        double speed = scanner.nextDouble();
                        System.out.print("Torque (Nm): ");
                        double torque = scanner.nextDouble();
                        System.out.print("Tool Wear (minutes): ");
                        double wear = scanner.nextDouble();

                        MachineReading reading = new MachineReading(mId, air, proc, speed, torque, wear);
                        int readingId = dao.saveReading(reading);

                        List<String> anomalies = anomalyDetector.inspectReading(readingId, reading);

                        PredictionResult result = mlService.predict(readingId, reading);
                        dao.savePrediction(result);

                        if (result.getRiskCategory().equals("HIGH")) {
                            dao.saveAlert(readingId, "HIGH_RISK", "Predicted failure probability exceeds threshold");
                        }

                        System.out.println("\n===========================================");
                        System.out.println("          MACHINE FAILURE PREDICTION");
                        System.out.println("===========================================");
                        System.out.println("Machine ID          : " + reading.getMachineId());
                        System.out.println("Air Temperature     : " + reading.getAirTemp() + " K");
                        System.out.println("Process Temperature : " + reading.getProcessTemp() + " K");
                        System.out.println("Rotational Speed    : " + reading.getRotationalSpeed() + " RPM");
                        System.out.println("Torque              : " + reading.getTorque() + " Nm");
                        System.out.println("Tool Wear           : " + reading.getToolWear() + " minutes");
                        System.out.println("-------------------------------------------");
                        System.out.println("PREDICTION RESULT");
                        System.out.println("-------------------------------------------");
                        System.out.printf("Failure Probability : %.1f%%\n", result.getFailureProbability());
                        System.out.println("Prediction          : " + result.getPrediction());
                        System.out.println("Risk Category       : " + result.getRiskCategory());

                        if (!anomalies.isEmpty()) {
                            System.out.println("\nDetected Anomalies:");
                            for (String a : anomalies) {
                                System.out.println(" - " + a);
                            }
                        }
                        System.out.println("===========================================");
                        break;
                    case 5:
                        reportService.displayAlerts();
                        break;
                    case 6:
                        reportService.generateSummaryReport();
                        break;
                    case 7:
                        System.out.println("Exiting System. Goodbye!");
                        scanner.close();
                        System.exit(0);
                    default:
                        System.out.println("Invalid option! Please try again.");
                }
            } catch (Exception e) {
                System.err.println("Error processing request: " + e.getMessage());
            }
        }
    }
}