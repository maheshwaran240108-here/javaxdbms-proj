
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

    public void evaluateModel(Instances data) throws Exception {

        if (rfClassifier == null) {

            if (new File(MODEL_PATH).exists()) {
                rfClassifier =
                        (RandomForest) SerializationHelper.read(MODEL_PATH);
            } else {
                System.out.println(
                        "No trained model found! Please train the model first."
                );
                return;
            }
        }

        Instances preparedData = prepareData(data);

        Evaluation eval = new Evaluation(preparedData);

        eval.crossValidateModel(
                rfClassifier,
                preparedData,
                10,
                new Random(1)
        );

        System.out.println("===========================================");
        System.out.println("        MODEL EVALUATION REPORT            ");
        System.out.println("===========================================");

        System.out.printf("Accuracy  : %.2f%%\n", eval.pctCorrect());
        System.out.printf("Precision : %.4f\n", eval.precision(1));
        System.out.printf("Recall    : %.4f\n", eval.recall(1));
        System.out.printf("F1-Score  : %.4f\n", eval.fMeasure(1));

        System.out.println("\nConfusion Matrix:");

        double[][] cm = eval.confusionMatrix();

        System.out.println(" TN: " + cm[0][0] + " | FP: " + cm[0][1]);
        System.out.println(" FN: " + cm[1][0] + " | TP: " + cm[1][1]);

        System.out.println("===========================================");
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
