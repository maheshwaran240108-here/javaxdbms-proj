package com.predmaint.model;

public class PredictionResult {
    private int readingId;
    private double failureProbability;
    private String prediction;
    private String riskCategory;

    public PredictionResult(int readingId, double failureProbability, String prediction, String riskCategory) {
        this.readingId = readingId;
        this.failureProbability = failureProbability;
        this.prediction = prediction;
        this.riskCategory = riskCategory;
    }

    public int getReadingId() { return readingId; }
    public double getFailureProbability() { return failureProbability; }
    public String getPrediction() { return prediction; }
    public String getRiskCategory() { return riskCategory; }
}