package com.predmaint.model;

public class MachineReading {
    private String machineId;
    private double airTemp;
    private double processTemp;
    private double rotationalSpeed;
    private double torque;
    private double toolWear;

    public MachineReading(String machineId, double airTemp, double processTemp, double rotationalSpeed, double torque, double toolWear) {
        this.machineId = machineId;
        this.airTemp = airTemp;
        this.processTemp = processTemp;
        this.rotationalSpeed = rotationalSpeed;
        this.torque = torque;
        this.toolWear = toolWear;
    }

    public String getMachineId() { return machineId; }
    public double getAirTemp() { return airTemp; }
    public double getProcessTemp() { return processTemp; }
    public double getRotationalSpeed() { return rotationalSpeed; }
    public double getTorque() { return torque; }
    public double getToolWear() { return toolWear; }
}