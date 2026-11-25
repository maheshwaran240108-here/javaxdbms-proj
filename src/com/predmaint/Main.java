package com.predmaint;

import com.predmaint.config.DatabaseConfig;

import javax.swing.SwingUtilities;

public class Main {
    public static void main(String[] args) {
        DatabaseConfig.initializeDatabase();
        SwingUtilities.invokeLater(() -> new MainFrame().setVisible(true));
    }
}