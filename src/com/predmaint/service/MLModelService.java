
package com.predmaint.service;

import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;

import weka.classifiers.Evaluation;
import weka.classifiers.trees.RandomForest;
import weka.core.*;
import weka.filters.Filter;
import weka.filters.supervised.instance.Resample;
import weka.filters.unsupervised.attribute.Remove;
import weka.filters.unsupervised.attribute.NumericToNominal;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

public class MLModelService {

    private RandomForest rfClassifier;
    private ArrayList<Attribute> attributes;
    private Instances datasetStructure;

    private static final String MODEL_PATH =
            "model_artifacts/random_forest.model";

    public MLModelService() {
        setupAttributes();
    }

    private void setupAttributes() {

        attributes = new ArrayList<>();

        attributes.add(new Attribute("AirTemp"));
        attributes.add(new Attribute("ProcessTemp"));
        attributes.add(new Attribute("RotationalSpeed"));
        attributes.add(new Attribute("Torque"));
        attributes.add(new Attribute("ToolWear"));

        ArrayList<String> classValues = new ArrayList<>();
        classValues.add("0");
        classValues.add("1");

        attributes.add(new Attribute("Target", classValues));

        datasetStructure =
                new Instances("PredictionStructure", attributes, 0);

        datasetStructure.setClassIndex(5);
    }

    // Select correct columns and prepare target class
    private Instances prepareData(Instances data) throws Exception {

        // Select columns 4 to 9:
        // Air temperature, Process temperature,
        // Rotational speed, Torque, Tool wear,
        // Machine failure

        data.setClassIndex(-1);

        Remove remove = new Remove();
        remove.setAttributeIndices("4-9");
        remove.setInvertSelection(true);
        remove.setInputFormat(data);

        Instances selectedData = Filter.useFilter(data, remove);

        // Convert Machine failure from numeric to nominal
        NumericToNominal convert = new NumericToNominal();
        convert.setAttributeIndices("6");
        convert.setInputFormat(selectedData);

        Instances preparedData =
                Filter.useFilter(selectedData, convert);

        // Machine failure is now the class attribute
        preparedData.setClassIndex(5);

        return preparedData;
    }

    public void trainModel(Instances data) throws Exception {

        Instances preparedData = prepareData(data);

        // Balance class distribution
        Resample resample = new Resample();
        resample.setBiasToUniformClass(1.0);
        resample.setInputFormat(preparedData);

        Instances balancedData =
                Filter.useFilter(preparedData, resample);

        rfClassifier = new RandomForest();
        rfClassifier.setNumIterations(100);

        rfClassifier.buildClassifier(balancedData);

        File dir = new File("model_artifacts");

        if (!dir.exists()) {
            dir.mkdirs();
        }

        SerializationHelper.write(MODEL_PATH, rfClassifier);

        System.out.println(
                "Model trained successfully and saved to " + MODEL_PATH
        );
    }

    public String evaluateModel(Instances data) throws Exception {
        if (rfClassifier == null && !new File(MODEL_PATH).exists()) {
            return "No trained model found. Train the model first.";
        }
        Map<String, Object> metrics = evaluateModelMetrics(data);
        Map<String, Double> cm = (Map<String, Double>) metrics.get("confusionMatrix");
        return String.format(Locale.US,
            "MODEL EVALUATION REPORT\n\nAccuracy   %.2f%%\nPrecision  %.4f\nRecall     %.4f\nF1 score   %.4f\n\nCONFUSION MATRIX\nTrue negative   %.0f\nFalse positive  %.0f\nFalse negative  %.0f\nTrue positive   %.0f",
            metrics.get("accuracy"), metrics.get("precision"), metrics.get("recall"), metrics.get("f1Score"),
            cm.get("trueNegative"), cm.get("falsePositive"), cm.get("falseNegative"), cm.get("truePositive"));
    }

    public Map<String, Object> evaluateModelMetrics(Instances data) throws Exception {
        if (rfClassifier == null) {
            if (new File(MODEL_PATH).exists()) {
                rfClassifier = (RandomForest) SerializationHelper.read(MODEL_PATH);
            } else {
                throw new IllegalStateException("No trained model found. Train the model first.");
            }
        }

        Instances preparedData = prepareData(data);
        Evaluation eval = new Evaluation(preparedData);
        eval.crossValidateModel(rfClassifier, preparedData, 10, new Random(1));
        double[][] matrix = eval.confusionMatrix();
        Map<String, Double> confusion = new LinkedHashMap<>();
        confusion.put("trueNegative", matrix[0][0]);
        confusion.put("falsePositive", matrix[0][1]);
        confusion.put("falseNegative", matrix[1][0]);
        confusion.put("truePositive", matrix[1][1]);

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("accuracy", eval.pctCorrect());
        metrics.put("precision", eval.precision(1));
        metrics.put("recall", eval.recall(1));
        metrics.put("f1Score", eval.fMeasure(1));
        metrics.put("confusionMatrix", confusion);
        metrics.put("rowsEvaluated", data.numInstances());
        return metrics;
    }

    public PredictionResult predict(
            int readingId,
            MachineReading reading
    ) throws Exception {

        if (rfClassifier == null) {

            if (new File(MODEL_PATH).exists()) {
                rfClassifier =
                        (RandomForest) SerializationHelper.read(MODEL_PATH);
            } else {
                throw new IllegalStateException(
                        "No trained model artifact found! Run training first."
                );
            }
        }

        Instance inst = new DenseInstance(6);
        inst.setDataset(datasetStructure);

        inst.setValue(attributes.get(0), reading.getAirTemp());
        inst.setValue(attributes.get(1), reading.getProcessTemp());
        inst.setValue(attributes.get(2), reading.getRotationalSpeed());
        inst.setValue(attributes.get(3), reading.getTorque());
        inst.setValue(attributes.get(4), reading.getToolWear());

        double[] proba =
                rfClassifier.distributionForInstance(inst);

        double failureProb = proba[1];

        String riskCategory = "LOW";
        String prediction = "NORMAL OPERATION";

        if (failureProb >= 0.70) {
            riskCategory = "HIGH";
            prediction = "FAILURE RISK DETECTED";
        } else if (failureProb >= 0.40) {
            riskCategory = "MEDIUM";
            prediction = "ELEVATED RISK";
        }

        return new PredictionResult(
                readingId,
                failureProb * 100,
                prediction,
                riskCategory
        );
    }
}
