package com.predmaint.service;

import weka.core.Instances;
import weka.core.converters.CSVLoader;

import java.io.File;
import java.io.IOException;

public class CSVImporterService {
    public static Instances loadDataset(String filePath) throws IOException {
        CSVLoader loader = new CSVLoader();
        loader.setSource(new File(filePath));
        Instances data = loader.getDataSet();

        if (data.classIndex() == -1) {
            data.setClassIndex(data.numAttributes() - 1);
        }
        return data;
    }
}