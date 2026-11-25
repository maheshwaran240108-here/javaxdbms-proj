package com.predmaint;

import com.predmaint.dao.MachineDataDAO;
import com.predmaint.model.MachineReading;
import com.predmaint.model.PredictionResult;
import com.predmaint.service.AnomalyDetectorService;
import com.predmaint.service.CSVImporterService;
import com.predmaint.service.MLModelService;
import weka.core.Instances;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingConstants;
import javax.swing.SwingWorker;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.function.Consumer;

public class MainFrame extends JFrame {
    private static final Color INK = new Color(31, 48, 47);
    private static final Color MUTED = new Color(111, 127, 123);
    private static final Color PAPER = new Color(246, 248, 245);
    private static final Color LINE = new Color(224, 231, 226);
    private static final Color GREEN = new Color(30, 112, 93);
    private static final Color CORAL = new Color(220, 105, 69);

    private final MachineDataDAO dao = new MachineDataDAO();
    private final MLModelService mlService = new MLModelService();
    private final AnomalyDetectorService anomalyDetector = new AnomalyDetectorService();
    private final CardLayout pageLayout = new CardLayout();
    private final JPanel pages = new JPanel(pageLayout);
    private final JLabel pageTitle = new JLabel("Overview");
    private final JLabel footerStatus = new JLabel("Ready");
    private final JTextField machineId = new JTextField("Machine-01");
    private final JTextField airTemp = new JTextField("300.0");
    private final JTextField processTemp = new JTextField("310.0");
    private final JTextField speed = new JTextField("1500");
    private final JTextField torque = new JTextField("40.0");
    private final JTextField wear = new JTextField("120");
    private final JLabel predictionHeadline = new JLabel("Awaiting a machine reading");
    private final JLabel predictionDetail = new JLabel("Submit a reading to assess failure risk.");
    private final JTextArea modelOutput = new JTextArea();
    private final JTextField datasetPath = new JTextField("data/ai4i2020.csv");
    private boolean busy;

    public MainFrame() {
        super("Predictive Maintenance | Plant Operations");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1024, 700));
        setSize(1240, 800);
        setLocationRelativeTo(null);
        getContentPane().setBackground(PAPER);
        setLayout(new BorderLayout());

        add(buildSidebar(), BorderLayout.WEST);
        add(buildWorkspace(), BorderLayout.CENTER);
        add(buildStatusBar(), BorderLayout.SOUTH);
        loadDashboard();
    }

    private JPanel buildSidebar() {
        JPanel sidebar = new JPanel(new BorderLayout());
        sidebar.setBackground(new Color(25, 55, 51));
        sidebar.setPreferredSize(new Dimension(224, 0));
        sidebar.setBorder(BorderFactory.createEmptyBorder(24, 16, 20, 16));

        JPanel brand = new JPanel(new BorderLayout(0, 5));
        brand.setOpaque(false);
        JLabel mark = new JLabel("FIELDNOTE  /  MAINTENANCE");
        mark.setFont(new Font("Segoe UI", Font.BOLD, 11));
        mark.setForeground(new Color(144, 192, 174));
        JLabel product = new JLabel("Plant watch");
        product.setFont(new Font("Segoe UI", Font.BOLD, 23));
        product.setForeground(Color.WHITE);
        brand.add(mark, BorderLayout.NORTH);
        brand.add(product, BorderLayout.CENTER);
        brand.setBorder(BorderFactory.createEmptyBorder(4, 8, 34, 8));
        sidebar.add(brand, BorderLayout.NORTH);

        JPanel nav = new JPanel(new GridBagLayout());
        nav.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.gridx = 0;
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;
        c.insets = new Insets(3, 0, 3, 0);
        addNavButton(nav, c, "01   Overview", "dashboard", "Overview");
        addNavButton(nav, c, "02   New reading", "prediction", "New reading");
        addNavButton(nav, c, "03   Alert log", "alerts", "Alert log");
        addNavButton(nav, c, "04   Dataset & model", "model", "Dataset & model");
        sidebar.add(nav, BorderLayout.CENTER);

        JPanel lower = new JPanel(new BorderLayout(0, 7));
        lower.setOpaque(false);
        JLabel rule = new JLabel("MODEL ARTIFACT");
        rule.setFont(new Font("Segoe UI", Font.BOLD, 10));
        rule.setForeground(new Color(144, 192, 174));
        JLabel modelState = new JLabel(new File("model_artifacts/random_forest.model").exists()
                ? "Random forest ready" : "Model not trained");
        modelState.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        modelState.setForeground(Color.WHITE);
        lower.add(rule, BorderLayout.NORTH);
        lower.add(modelState, BorderLayout.CENTER);
        lower.setBorder(BorderFactory.createEmptyBorder(14, 8, 4, 8));
        sidebar.add(lower, BorderLayout.SOUTH);
        return sidebar;
    }

    private void addNavButton(JPanel nav, GridBagConstraints c, String text, String key, String title) {
        JButton button = new JButton(text);
        button.setHorizontalAlignment(SwingConstants.LEFT);
        button.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        button.setForeground(new Color(220, 233, 227));
        button.setBackground(new Color(25, 55, 51));
        button.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 8));
        button.setFocusPainted(false);
        button.setOpaque(true);
        button.addActionListener(event -> {
            pageTitle.setText(title);
            pageLayout.show(pages, key);
            if ("dashboard".equals(key)) loadDashboard();
            if ("alerts".equals(key)) loadAlerts();
        });
        nav.add(button, c);
    }

    private JPanel buildWorkspace() {
        JPanel workspace = new JPanel(new BorderLayout());
        workspace.setBackground(PAPER);
        workspace.add(buildHeader(), BorderLayout.NORTH);

        pages.setBackground(PAPER);
        pages.setBorder(BorderFactory.createEmptyBorder(4, 34, 28, 34));
        pages.add(buildDashboardPage(), "dashboard");
        pages.add(buildPredictionPage(), "prediction");
        pages.add(buildAlertsPage(), "alerts");
        pages.add(buildModelPage(), "model");
        workspace.add(pages, BorderLayout.CENTER);
        return workspace;
    }

    private JPanel buildHeader() {
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(PAPER);
        header.setBorder(BorderFactory.createEmptyBorder(23, 36, 16, 38));
        pageTitle.setFont(new Font("Segoe UI", Font.BOLD, 23));
        pageTitle.setForeground(INK);
        JLabel online = new JLabel("●  SYSTEM READY");
        online.setFont(new Font("Segoe UI", Font.BOLD, 10));
        online.setForeground(GREEN);
        header.add(pageTitle, BorderLayout.WEST);
        header.add(online, BorderLayout.EAST);
        return header;
    }

    private JPanel buildDashboardPage() {
        JPanel page = new JPanel(new BorderLayout(0, 20));
        page.setOpaque(false);

        JPanel top = new JPanel(new BorderLayout(0, 16));
        top.setOpaque(false);
        JLabel intro = new JLabel("A clear view of machine health and recent decisions.");
        intro.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        intro.setForeground(MUTED);
        top.add(intro, BorderLayout.NORTH);

        JPanel metrics = new JPanel(new GridBagLayout());
        metrics.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.fill = GridBagConstraints.BOTH;
        c.weightx = 1;
        c.insets = new Insets(0, 0, 0, 12);
        JLabel readings = metricCard("READINGS PROCESSED", "0", "Total records analyzed");
        JLabel highRisk = metricCard("HIGH-RISK PREDICTIONS", "0", "Requires maintenance review");
        JLabel openAlerts = metricCard("OPEN ALERTS", "0", "Anomalies and failure risks");
        c.gridx = 0;
        metrics.add(readings.getParent(), c);
        c.gridx = 1;
        metrics.add(highRisk.getParent(), c);
        c.gridx = 2;
        c.insets = new Insets(0, 0, 0, 0);
        metrics.add(openAlerts.getParent(), c);
        top.add(metrics, BorderLayout.CENTER);
        page.add(top, BorderLayout.NORTH);

        JPanel activity = panel();
        activity.setLayout(new BorderLayout(0, 12));
        activity.setBorder(BorderFactory.createEmptyBorder(18, 18, 14, 18));
        JPanel sectionHeader = new JPanel(new BorderLayout());
        sectionHeader.setOpaque(false);
        JLabel sectionTitle = sectionTitle("Recent predictions");
        JLabel hint = new JLabel("Latest 8 machine readings");
        hint.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        hint.setForeground(MUTED);
        sectionHeader.add(sectionTitle, BorderLayout.WEST);
        sectionHeader.add(hint, BorderLayout.EAST);
        JTable table = buildTable(new String[]{"TIME", "MACHINE", "RISK", "FAILURE PROBABILITY", "ASSESSMENT"});
        activity.add(sectionHeader, BorderLayout.NORTH);
        activity.add(new JScrollPane(table), BorderLayout.CENTER);
        page.add(activity, BorderLayout.CENTER);
        return page;
    }

    private JLabel metricCard(String label, String value, String detail) {
        JPanel card = panel();
        card.setLayout(new BorderLayout(0, 8));
        card.setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 14));
        JLabel caption = new JLabel(label);
        caption.setFont(new Font("Segoe UI", Font.BOLD, 10));
        caption.setForeground(MUTED);
        JLabel number = new JLabel(value);
        number.setFont(new Font("Segoe UI", Font.BOLD, 27));
        number.setForeground(INK);
        JLabel note = new JLabel(detail);
        note.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        note.setForeground(MUTED);
        card.add(caption, BorderLayout.NORTH);
        card.add(number, BorderLayout.CENTER);
        card.add(note, BorderLayout.SOUTH);
        number.putClientProperty("metric-card", label);
        return number;
    }

    private JPanel buildPredictionPage() {
        JPanel page = new JPanel(new BorderLayout(22, 0));
        page.setOpaque(false);
        JPanel form = panel();
        form.setLayout(new BorderLayout(0, 18));
        form.setBorder(BorderFactory.createEmptyBorder(22, 24, 22, 24));

        JPanel heading = new JPanel(new BorderLayout(0, 6));
        heading.setOpaque(false);
        heading.add(sectionTitle("Machine reading"), BorderLayout.NORTH);
        JLabel note = new JLabel("Enter current sensor values to run a failure-risk assessment.");
        note.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        note.setForeground(MUTED);
        heading.add(note, BorderLayout.CENTER);
        form.add(heading, BorderLayout.NORTH);

        JPanel fields = new JPanel(new GridBagLayout());
        fields.setOpaque(false);
        addField(fields, 0, "Machine ID", machineId);
        addField(fields, 1, "Air temperature", airTemp, "K");
        addField(fields, 2, "Process temperature", processTemp, "K");
        addField(fields, 3, "Rotational speed", speed, "RPM");
        addField(fields, 4, "Torque", torque, "Nm");
        addField(fields, 5, "Tool wear", wear, "minutes");
        form.add(fields, BorderLayout.CENTER);

        JButton run = primaryButton("Run prediction");
        run.addActionListener(event -> runPrediction());
        form.add(run, BorderLayout.SOUTH);
        page.add(form, BorderLayout.CENTER);

        JPanel result = panel();
        result.setPreferredSize(new Dimension(300, 0));
        result.setLayout(new BorderLayout(0, 15));
        result.setBorder(BorderFactory.createEmptyBorder(22, 20, 22, 20));
        JLabel resultLabel = new JLabel("LATEST ASSESSMENT");
        resultLabel.setFont(new Font("Segoe UI", Font.BOLD, 10));
        resultLabel.setForeground(MUTED);
        JPanel resultText = new JPanel(new BorderLayout(0, 10));
        resultText.setOpaque(false);
        predictionHeadline.setFont(new Font("Segoe UI", Font.BOLD, 20));
        predictionHeadline.setForeground(INK);
        predictionHeadline.setVerticalAlignment(SwingConstants.TOP);
        predictionDetail.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        predictionDetail.setForeground(MUTED);
        predictionDetail.setVerticalAlignment(SwingConstants.TOP);
        predictionDetail.setBorder(BorderFactory.createEmptyBorder(0, 0, 12, 0));
        resultText.add(predictionHeadline, BorderLayout.NORTH);
        resultText.add(predictionDetail, BorderLayout.CENTER);
        result.add(resultLabel, BorderLayout.NORTH);
        result.add(resultText, BorderLayout.CENTER);
        page.add(result, BorderLayout.EAST);
        return page;
    }

    private JPanel buildAlertsPage() {
        JPanel page = new JPanel(new BorderLayout(0, 18));
        page.setOpaque(false);
        JLabel description = new JLabel("Anomalies and elevated failure risks recorded from machine readings.");
        description.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        description.setForeground(MUTED);
        page.add(description, BorderLayout.NORTH);

        JPanel content = panel();
        content.setLayout(new BorderLayout(0, 12));
        content.setBorder(BorderFactory.createEmptyBorder(18, 18, 16, 18));
        JTable table = buildTable(new String[]{"TIME", "MACHINE", "TYPE", "STATUS", "DETAIL"});
        content.add(new JScrollPane(table), BorderLayout.CENTER);
        page.add(content, BorderLayout.CENTER);
        return page;
    }

    private JPanel buildModelPage() {
        JPanel page = new JPanel(new BorderLayout(0, 18));
        page.setOpaque(false);
        JLabel description = new JLabel("Load the historical CSV, train the classifier, or review its performance.");
        description.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        description.setForeground(MUTED);
        page.add(description, BorderLayout.NORTH);

        JPanel content = panel();
        content.setLayout(new BorderLayout(0, 16));
        content.setBorder(BorderFactory.createEmptyBorder(20, 22, 20, 22));
        JPanel controls = new JPanel(new BorderLayout(10, 12));
        controls.setOpaque(false);
        JPanel pathRow = new JPanel(new BorderLayout(10, 0));
        pathRow.setOpaque(false);
        datasetPath.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        datasetPath.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(LINE), BorderFactory.createEmptyBorder(9, 10, 9, 10)));
        JButton browse = secondaryButton("Browse CSV");
        browse.addActionListener(event -> chooseDataset());
        pathRow.add(datasetPath, BorderLayout.CENTER);
        pathRow.add(browse, BorderLayout.EAST);
        controls.add(pathRow, BorderLayout.NORTH);

        JPanel actions = new JPanel(new GridBagLayout());
        actions.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(0, 0, 0, 10);
        c.gridx = 0;
        JButton importButton = secondaryButton("Import dataset");
        importButton.addActionListener(event -> importDataset());
        actions.add(importButton, c);
        c.gridx = 1;
        JButton trainButton = primaryButton("Train model");
        trainButton.addActionListener(event -> trainModel());
        actions.add(trainButton, c);
        c.gridx = 2;
        c.insets = new Insets(0, 0, 0, 0);
        JButton evaluateButton = secondaryButton("Evaluate model");
        evaluateButton.addActionListener(event -> evaluateModel());
        actions.add(evaluateButton, c);
        controls.add(actions, BorderLayout.CENTER);
        content.add(controls, BorderLayout.NORTH);

        modelOutput.setEditable(false);
        modelOutput.setFont(new Font("Consolas", Font.PLAIN, 13));
        modelOutput.setForeground(INK);
        modelOutput.setBackground(new Color(249, 250, 248));
        modelOutput.setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));
        modelOutput.setText("No recent dataset or model activity.");
        content.add(new JScrollPane(modelOutput), BorderLayout.CENTER);
        page.add(content, BorderLayout.CENTER);
        return page;
    }

    private JPanel buildStatusBar() {
        JPanel status = new JPanel(new BorderLayout());
        status.setBackground(Color.WHITE);
        status.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, LINE),
                BorderFactory.createEmptyBorder(8, 18, 8, 18)));
        footerStatus.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        footerStatus.setForeground(MUTED);
        status.add(footerStatus, BorderLayout.WEST);
        JLabel dbLabel = new JLabel("SQLITE  /  LOCAL DATABASE");
        dbLabel.setFont(new Font("Segoe UI", Font.BOLD, 9));
        dbLabel.setForeground(MUTED);
        status.add(dbLabel, BorderLayout.EAST);
        return status;
    }

    private void addField(JPanel fields, int row, String labelText, JTextField input) {
        addField(fields, row, labelText, input, "");
    }

    private void addField(JPanel fields, int row, String labelText, JTextField input, String unit) {
        GridBagConstraints c = new GridBagConstraints();
        c.gridy = row;
        c.insets = new Insets(0, 0, 13, 10);
        c.anchor = GridBagConstraints.WEST;
        JLabel label = new JLabel(labelText);
        label.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        label.setForeground(INK);
        c.gridx = 0;
        c.weightx = 0;
        fields.add(label, c);

        input.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        input.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(LINE), BorderFactory.createEmptyBorder(8, 9, 8, 9)));
        c.gridx = 1;
        c.weightx = 1;
        c.fill = GridBagConstraints.HORIZONTAL;
        fields.add(input, c);

        JLabel units = new JLabel(unit);
        units.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        units.setForeground(MUTED);
        c.gridx = 2;
        c.weightx = 0;
        c.fill = GridBagConstraints.NONE;
        c.insets = new Insets(0, 0, 13, 0);
        fields.add(units, c);
    }

    private void loadDashboard() {
        runTask("Refreshing overview...", () -> new Object[]{
                dao.getDashboardStats(), dao.getRecentPredictions()
        }, data -> {
            int[] stats = (int[]) data[0];
            updateMetric("READINGS PROCESSED", stats[0]);
            updateMetric("HIGH-RISK PREDICTIONS", stats[1]);
            updateMetric("OPEN ALERTS", stats[2]);
            updateTable("Recent predictions", (List<String[]>) data[1]);
        });
    }

    private void loadAlerts() {
        runTask("Loading alerts...", dao::getAlerts, rows -> updateTable("Alert log", rows));
    }

    private void updateMetric(String key, int value) {
        for (Component component : getComponents()) {
            findMetric(component, key, value);
        }
    }

    private void findMetric(Component component, String key, int value) {
        if (component instanceof JLabel) {
            JLabel label = (JLabel) component;
            if (key.equals(label.getClientProperty("metric-card"))) label.setText(String.valueOf(value));
        }
        if (component instanceof java.awt.Container) {
            for (Component child : ((java.awt.Container) component).getComponents()) findMetric(child, key, value);
        }
    }

    private void updateTable(String pageName, List<String[]> rows) {
        Component[] pageComponents = pages.getComponents();
        for (Component page : pageComponents) {
            if (!(page instanceof JPanel)) continue;
            for (Component child : ((JPanel) page).getComponents()) {
                if (!(child instanceof JPanel)) continue;
                updateTablesIn(child, pageName, rows);
            }
        }
    }

    private void updateTablesIn(Component component, String pageName, List<String[]> rows) {
        if (component instanceof JTable) {
            JTable table = (JTable) component;
            boolean isAlerts = "Alert log".equals(pageName);
            boolean belongs = isAlerts ? table.getColumnCount() == 5
                    && "TYPE".equals(table.getColumnName(2))
                    : table.getColumnCount() == 5 && "RISK".equals(table.getColumnName(2));
            if (belongs) {
                DefaultTableModel model = (DefaultTableModel) table.getModel();
                model.setRowCount(0);
                for (String[] row : rows) model.addRow(row);
            }
        }
        if (component instanceof java.awt.Container) {
            for (Component child : ((java.awt.Container) component).getComponents()) updateTablesIn(child, pageName, rows);
        }
    }

    private void runPrediction() {
        final MachineReading reading;
        try {
            String id = machineId.getText().trim();
            if (id.isEmpty()) throw new IllegalArgumentException("Machine ID is required.");
            reading = new MachineReading(id, parse(airTemp, "Air temperature"),
                    parse(processTemp, "Process temperature"), parse(speed, "Rotational speed"),
                    parse(torque, "Torque"), parse(wear, "Tool wear"));
        } catch (IllegalArgumentException ex) {
            JOptionPane.showMessageDialog(this, ex.getMessage(), "Check machine reading", JOptionPane.WARNING_MESSAGE);
            return;
        }

        runTask("Running prediction...", () -> {
            int readingId = dao.saveReading(reading);
            List<String> anomalies = anomalyDetector.inspectReading(readingId, reading);
            PredictionResult result = mlService.predict(readingId, reading);
            dao.savePrediction(result);
            if ("HIGH".equals(result.getRiskCategory())) {
                dao.saveAlert(readingId, "HIGH_RISK", "Predicted failure probability exceeds threshold");
            }
            return new Object[]{result, anomalies};
        }, data -> {
            PredictionResult result = (PredictionResult) data[0];
            List<String> anomalies = (List<String>) data[1];
            predictionHeadline.setText(result.getRiskCategory() + " RISK");
            predictionHeadline.setForeground("HIGH".equals(result.getRiskCategory()) ? CORAL : GREEN);
            StringBuilder detail = new StringBuilder(String.format("Failure probability: %.1f%%\n%s",
                    result.getFailureProbability(), result.getPrediction()));
            if (!anomalies.isEmpty()) {
                detail.append("\n\nDetected anomalies:\n");
                for (String anomaly : anomalies) detail.append("- ").append(anomaly).append('\n');
            } else {
                detail.append("\n\nNo sensor anomalies detected.");
            }
            predictionDetail.setText("<html>" + detail.toString().replace("&", "&amp;")
                    .replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>") + "</html>");
            footerStatus.setText("Prediction saved for " + reading.getMachineId());
        });
    }

    private double parse(JTextField field, String label) {
        try {
            double value = Double.parseDouble(field.getText().trim());
            if (Double.isNaN(value) || Double.isInfinite(value)) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(label + " must be a valid number.");
        }
    }

    private void chooseDataset() {
        JFileChooser chooser = new JFileChooser(new File("data"));
        chooser.setDialogTitle("Choose historical dataset");
        if (chooser.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
            datasetPath.setText(chooser.getSelectedFile().getPath());
        }
    }

    private void importDataset() {
        String path = datasetPath.getText().trim();
        runTask("Importing dataset...", () -> CSVImporterService.loadDataset(path), data -> {
            modelOutput.setText("Dataset loaded successfully.\n\nRows: " + data.numInstances()
                    + "\nColumns: " + data.numAttributes() + "\nFile: " + path);
        });
    }

    private void trainModel() {
        String path = datasetPath.getText().trim();
        runTask("Training random forest...", () -> {
            Instances data = CSVImporterService.loadDataset(path);
            mlService.trainModel(data);
            return data.numInstances();
        }, rows -> modelOutput.setText("Training complete.\n\nAlgorithm: Random Forest\nTraining rows: "
                + rows + "\nModel saved to: model_artifacts/random_forest.model"));
    }

    private void evaluateModel() {
        String path = datasetPath.getText().trim();
        runTask("Evaluating model...", () -> mlService.evaluateModel(CSVImporterService.loadDataset(path)),
                modelOutput::setText);
    }

    private <T> void runTask(String message, Callable<T> operation, Consumer<T> onSuccess) {
        if (busy) return;
        busy = true;
        footerStatus.setText(message);
        setCursor(Cursor.getPredefinedCursor(Cursor.WAIT_CURSOR));
        new SwingWorker<T, Void>() {
            @Override
            protected T doInBackground() throws Exception {
                return operation.call();
            }

            @Override
            protected void done() {
                busy = false;
                setCursor(Cursor.getDefaultCursor());
                try {
                    onSuccess.accept(get());
                    if (footerStatus.getText().equals(message)) footerStatus.setText("Ready");
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    showError(ex);
                } catch (ExecutionException ex) {
                    showError(ex.getCause() == null ? ex : ex.getCause());
                }
            }
        }.execute();
    }

    private void showError(Throwable error) {
        String message = error.getMessage() == null ? error.toString() : error.getMessage();
        footerStatus.setText("Action failed");
        JOptionPane.showMessageDialog(this, message, "Operation failed", JOptionPane.ERROR_MESSAGE);
    }

    private JTable buildTable(String[] columns) {
        DefaultTableModel model = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        JTable table = new JTable(model);
        table.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        table.setForeground(INK);
        table.setBackground(Color.WHITE);
        table.setRowHeight(36);
        table.setShowGrid(false);
        table.setIntercellSpacing(new Dimension(0, 0));
        table.setFillsViewportHeight(true);
        table.getTableHeader().setFont(new Font("Segoe UI", Font.BOLD, 10));
        table.getTableHeader().setForeground(MUTED);
        table.getTableHeader().setBackground(new Color(249, 250, 248));
        table.getTableHeader().setPreferredSize(new Dimension(0, 34));
        table.setDefaultRenderer(Object.class, new DefaultTableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable source, Object value, boolean selected,
                                                            boolean focus, int row, int column) {
                Component cell = super.getTableCellRendererComponent(source, value, selected, focus, row, column);
                setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, LINE));
                setForeground(INK);
                setBackground(Color.WHITE);
                setFont(new Font("Segoe UI", Font.PLAIN, 12));
                setToolTipText(value == null ? null : value.toString());
                return cell;
            }
        });
        table.setBorder(BorderFactory.createEmptyBorder());
        return table;
    }

    private JPanel panel() {
        JPanel panel = new JPanel();
        panel.setBackground(Color.WHITE);
        panel.setBorder(BorderFactory.createLineBorder(LINE));
        return panel;
    }

    private JLabel sectionTitle(String text) {
        JLabel title = new JLabel(text);
        title.setFont(new Font("Segoe UI", Font.BOLD, 15));
        title.setForeground(INK);
        return title;
    }

    private JButton primaryButton(String text) {
        return styleButton(text, GREEN, Color.WHITE);
    }

    private JButton secondaryButton(String text) {
        return styleButton(text, Color.WHITE, INK);
    }

    private JButton styleButton(String text, Color background, Color foreground) {
        JButton button = new JButton(text);
        button.setFont(new Font("Segoe UI", Font.BOLD, 12));
        button.setForeground(foreground);
        button.setBackground(background);
        button.setFocusPainted(false);
        button.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(background.equals(Color.WHITE) ? LINE : background),
                BorderFactory.createEmptyBorder(9, 14, 9, 14)));
        button.setOpaque(true);
        return button;
    }
}