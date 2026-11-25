package com.predmaint.service;

import weka.core.Instances;
import weka.core.converters.CSVLoader;

import java.io.File;
import java.io.InputStream;
import java.io.IOException;

public class CSVImporterService {
    public static Instances loadDataset(String filePath) throws IOException {
        return loadDataset(new File(filePath));
    }

    private static Instances loadDataset(File file) throws IOException {
        CSVLoader loader = new CSVLoader();
        try {
            loader.setSource(file);
            return readData(loader);
        } finally {
            loader.reset();
        }
    }

    public static Instances loadDataset(InputStream source) throws IOException {
        CSVLoader loader = new CSVLoader();
        try {
            loader.setSource(source);
            return readData(loader);
        } finally {
            loader.reset();
        }
    }

    private static Instances readData(CSVLoader loader) throws IOException {
        Instances data = loader.getDataSet();
        if (data.classIndex() == -1) {
            data.setClassIndex(data.numAttributes() - 1);
        }
        return data;
    }
}