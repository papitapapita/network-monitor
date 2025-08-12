import { SettingsManager } from '../src/services/settings.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = jest.mocked(fs);
// Mock path
jest.mock('path');
const mockedPath = jest.mocked(path);
describe('SettingsManager', () => {
    let settingsManager;
    let mockDataFilePath;
    beforeEach(() => {
        jest.clearAllMocks();
        mockDataFilePath = '/mock/path/data.ts';
        mockedPath.resolve.mockReturnValue(mockDataFilePath);
        // Reset require cache mock
        delete require.cache[mockDataFilePath];
        settingsManager = new SettingsManager();
    });
    afterEach(() => {
        // Clean up any listeners
        settingsManager.removeAllListeners();
    });
    describe('Constructor', () => {
        test('should create instance with default parameters', () => {
            expect(settingsManager).toBeInstanceOf(SettingsManager);
            expect(settingsManager).toBeInstanceOf(EventEmitter);
        });
        test('should create instance with custom parameters', () => {
            const customPath = '/custom/path/data.ts';
            const customAutoSave = false;
            const customManager = new SettingsManager(customPath, customAutoSave);
            expect(customManager).toBeInstanceOf(SettingsManager);
            expect(mockedPath.resolve).toHaveBeenCalledWith(customPath);
        });
    });
    describe('initialize', () => {
        test('should initialize successfully and emit data-loaded event', async () => {
            const mockData = getMockDatabaseData();
            mockedFs.access.mockResolvedValueOnce(undefined);
            mockedFs.readFile.mockResolvedValueOnce('export const databaseData = {}');
            // Mock dynamic import
            const mockModule = { databaseData: mockData };
            jest.doMock(mockDataFilePath, () => mockModule, {
                virtual: true
            });
            const dataLoadedSpy = jest.fn();
            settingsManager.onDataLoaded(dataLoadedSpy);
            await settingsManager.initialize();
            expect(dataLoadedSpy).toHaveBeenCalledWith(expect.any(Object));
        });
        test('should emit error and rethrow when initialization fails', async () => {
            const error = new Error('File not found');
            mockedFs.access.mockRejectedValueOnce(error);
            mockedFs.writeFile.mockRejectedValueOnce(error);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            await expect(settingsManager.initialize()).rejects.toThrow('File not found');
            expect(errorSpy).toHaveBeenCalledWith(error);
        });
    });
    describe('Event listener methods', () => {
        test('should register settings-updated listener', () => {
            const listener = jest.fn();
            const result = settingsManager.onSettingsUpdated(listener);
            expect(result).toBe(settingsManager);
            expect(settingsManager.listenerCount('settings-updated')).toBe(1);
        });
        test('should register ap-added listener', () => {
            const listener = jest.fn();
            const result = settingsManager.onAPAdded(listener);
            expect(result).toBe(settingsManager);
            expect(settingsManager.listenerCount('ap-added')).toBe(1);
        });
        test('should register ap-removed listener', () => {
            const listener = jest.fn();
            const result = settingsManager.onAPRemoved(listener);
            expect(result).toBe(settingsManager);
            expect(settingsManager.listenerCount('ap-removed')).toBe(1);
        });
        test('should register data-loaded listener', () => {
            const listener = jest.fn();
            const result = settingsManager.onDataLoaded(listener);
            expect(result).toBe(settingsManager);
            expect(settingsManager.listenerCount('data-loaded')).toBe(1);
        });
        test('should register error listener', () => {
            const listener = jest.fn();
            const result = settingsManager.onError(listener);
            expect(result).toBe(settingsManager);
            expect(settingsManager.listenerCount('error')).toBe(1);
        });
    });
    describe('getSettings', () => {
        test('should return a copy of global settings', () => {
            const settings = settingsManager.getSettings();
            expect(settings).toEqual({
                defaultTimeout: 3000,
                defaultFrequency: 5000,
                maxRetries: 3,
                enableLogging: true,
                logLevel: 'info',
                alertThreshold: 1000,
                batchSize: 10
            });
            // Verify it's a copy, not a reference
            settings.defaultTimeout = 9999;
            expect(settingsManager.getSettings().defaultTimeout).toBe(3000);
        });
    });
    describe('getAPList', () => {
        test('should return a copy of AP list', () => {
            const apList = settingsManager.getAPList();
            expect(apList).toHaveLength(2);
            expect(apList[0].IPaddress).toBe('8.8.8.8');
            expect(apList[1].IPaddress).toBe('8.8.4.4');
            // Verify it's a copy, not a reference
            apList[0].name = 'Modified';
            expect(settingsManager.getAPList()[0].name).toBe('Google DNS');
        });
    });
    describe('getAP', () => {
        test('should return specific AP entry when found', () => {
            const ap = settingsManager.getAP('8.8.8.8');
            expect(ap).not.toBeNull();
            expect(ap?.IPaddress).toBe('8.8.8.8');
            expect(ap?.name).toBe('Google DNS');
        });
        test('should return null when AP not found', () => {
            const ap = settingsManager.getAP('1.2.3.4');
            expect(ap).toBeNull();
        });
        test('should return a copy, not reference', () => {
            const ap = settingsManager.getAP('8.8.8.8');
            if (ap) {
                ap.name = 'Modified';
                expect(settingsManager.getAP('8.8.8.8')?.name).toBe('Google DNS');
            }
        });
    });
    describe('addAP', () => {
        test('should add new AP successfully with autosave', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const apAddedSpy = jest.fn();
            settingsManager.onAPAdded(apAddedSpy);
            const newAP = {
                IPaddress: '1.1.1.1',
                frequencyToPoll: 2000,
                name: 'Cloudflare DNS',
                description: 'Cloudflare public DNS'
            };
            await settingsManager.addAP(newAP);
            expect(apAddedSpy).toHaveBeenCalledWith(expect.objectContaining({
                ...newAP,
                timeout: 3000, // default timeout
                enabled: true, // default enabled
                lastUpdated: expect.any(Date)
            }));
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
        test('should add AP with custom timeout and enabled status', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const newAP = {
                IPaddress: '1.1.1.1',
                frequencyToPoll: 2000,
                timeout: 5000,
                enabled: false,
                name: 'Custom AP',
                description: 'Custom description'
            };
            await settingsManager.addAP(newAP);
            const addedAP = settingsManager.getAP('1.1.1.1');
            expect(addedAP?.timeout).toBe(5000);
            expect(addedAP?.enabled).toBe(false);
        });
        test('should throw error when IP already exists', async () => {
            const duplicateAP = {
                IPaddress: '8.8.8.8', // Already exists in default data
                frequencyToPoll: 2000,
                name: 'Duplicate',
                description: 'Duplicate IP'
            };
            await expect(settingsManager.addAP(duplicateAP)).rejects.toThrow('IP address 8.8.8.8 already exists');
        });
        test('should emit error and rethrow when save fails', async () => {
            const saveError = new Error('Save failed');
            mockedFs.writeFile.mockRejectedValueOnce(saveError);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            const newAP = {
                IPaddress: '1.1.1.1',
                frequencyToPoll: 2000,
                name: 'Test AP',
                description: 'Test'
            };
            await expect(settingsManager.addAP(newAP)).rejects.toThrow('Save failed');
            expect(errorSpy).toHaveBeenCalledWith(saveError);
        });
    });
    describe('removeAP', () => {
        test('should remove existing AP successfully', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const apRemovedSpy = jest.fn();
            settingsManager.onAPRemoved(apRemovedSpy);
            const result = await settingsManager.removeAP('8.8.8.8');
            expect(result).toBe(true);
            expect(apRemovedSpy).toHaveBeenCalledWith('8.8.8.8');
            expect(settingsManager.getAP('8.8.8.8')).toBeNull();
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
        test('should return false when AP not found', async () => {
            const result = await settingsManager.removeAP('1.2.3.4');
            expect(result).toBe(false);
        });
        test('should emit error and rethrow when save fails', async () => {
            const saveError = new Error('Save failed');
            mockedFs.writeFile.mockRejectedValueOnce(saveError);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            await expect(settingsManager.removeAP('8.8.8.8')).rejects.toThrow('Save failed');
            expect(errorSpy).toHaveBeenCalledWith(saveError);
        });
    });
    describe('updateBatchSettings', () => {
        test('should update multiple APs successfully', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const settingsUpdatedSpy = jest.fn();
            settingsManager.onSettingsUpdated(settingsUpdatedSpy);
            const IPaddresses = ['8.8.8.8', '8.8.4.4'];
            const options = {
                frequencyToPoll: 10000,
                timeout: 5000,
                enabled: false
            };
            await settingsManager.updateBatchSettings(IPaddresses, options);
            expect(settingsUpdatedSpy).toHaveBeenCalledWith({
                type: 'batch',
                changes: expect.objectContaining({
                    '8.8.8.8': expect.objectContaining({
                        old: expect.any(Object),
                        new: expect.objectContaining({
                            frequencyToPoll: 10000,
                            timeout: 5000,
                            enabled: false
                        })
                    }),
                    '8.8.4.4': expect.objectContaining({
                        old: expect.any(Object),
                        new: expect.objectContaining({
                            frequencyToPoll: 10000,
                            timeout: 5000,
                            enabled: false
                        })
                    })
                })
            });
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
        test('should skip non-existent IPs in batch update', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const settingsUpdatedSpy = jest.fn();
            settingsManager.onSettingsUpdated(settingsUpdatedSpy);
            const IPaddresses = ['8.8.8.8', '1.2.3.4', '8.8.4.4']; // 1.2.3.4 doesn't exist
            const options = { frequencyToPoll: 10000 };
            await settingsManager.updateBatchSettings(IPaddresses, options);
            expect(settingsUpdatedSpy).toHaveBeenCalledWith({
                type: 'batch',
                changes: expect.objectContaining({
                    '8.8.8.8': expect.any(Object),
                    '8.8.4.4': expect.any(Object)
                })
            });
            // Should not contain non-existent IP
            const call = settingsUpdatedSpy.mock.calls[0][0];
            expect(call.changes).not.toHaveProperty('1.2.3.4');
        });
        test('should emit error and rethrow when save fails', async () => {
            const saveError = new Error('Save failed');
            mockedFs.writeFile.mockRejectedValueOnce(saveError);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            await expect(settingsManager.updateBatchSettings(['8.8.8.8'], {
                frequencyToPoll: 1000
            })).rejects.toThrow('Save failed');
            expect(errorSpy).toHaveBeenCalledWith(saveError);
        });
    });
    describe('updateIndividualAPSettings', () => {
        test('should update individual AP settings successfully', async () => {
            const settingsUpdatedSpy = jest.fn();
            settingsManager.onSettingsUpdated(settingsUpdatedSpy);
            const options = {
                IPaddress: '8.8.8.8',
                frequencyToPoll: 15000,
                timeout: 8000,
                enabled: false,
                name: 'Updated Google DNS',
                description: 'Updated description'
            };
            await settingsManager.updateIndividualAPSettings(options);
            expect(settingsUpdatedSpy).toHaveBeenCalledWith({
                type: 'individual',
                changes: {
                    IPaddress: '8.8.8.8',
                    old: expect.any(Object),
                    new: expect.objectContaining({
                        IPaddress: '8.8.8.8',
                        frequencyToPoll: 15000,
                        timeout: 8000,
                        enabled: false,
                        name: 'Updated Google DNS',
                        description: 'Updated description',
                        lastUpdated: expect.any(Date)
                    })
                }
            });
        });
        test('should throw error when IP not found', async () => {
            const options = {
                IPaddress: '1.2.3.4',
                frequencyToPoll: 1000
            };
            await expect(settingsManager.updateIndividualAPSettings(options)).rejects.toThrow('IP address 1.2.3.4 not found');
        });
        test('should update only specified fields', async () => {
            const originalAP = settingsManager.getAP('8.8.8.8');
            await settingsManager.updateIndividualAPSettings({
                IPaddress: '8.8.8.8',
                name: 'New Name Only'
            });
            const updatedAP = settingsManager.getAP('8.8.8.8');
            expect(updatedAP?.name).toBe('New Name Only');
            expect(updatedAP?.frequencyToPoll).toBe(originalAP?.frequencyToPoll);
            expect(updatedAP?.timeout).toBe(originalAP?.timeout);
        });
    });
    describe('updateGlobalAPSettings', () => {
        test('should update global settings and apply to all APs', async () => {
            const settingsUpdatedSpy = jest.fn();
            settingsManager.onSettingsUpdated(settingsUpdatedSpy);
            const options = {
                defaultFrequency: 20000,
                defaultTimeout: 10000,
                maxRetries: 5,
                enableLogging: false,
                logLevel: 'error',
                alertThreshold: 2000,
                batchSize: 20
            };
            await settingsManager.updateGlobalAPSettings(options);
            const updatedSettings = settingsManager.getSettings();
            expect(updatedSettings.defaultFrequency).toBe(20000);
            expect(updatedSettings.defaultTimeout).toBe(10000);
            expect(updatedSettings.maxRetries).toBe(5);
            expect(updatedSettings.enableLogging).toBe(false);
            expect(updatedSettings.logLevel).toBe('error');
            expect(updatedSettings.alertThreshold).toBe(2000);
            expect(updatedSettings.batchSize).toBe(20);
            // Check that defaultFrequency was applied to all APs
            const apList = settingsManager.getAPList();
            apList.forEach((ap) => {
                expect(ap.frequencyToPoll).toBe(20000);
            });
            expect(settingsUpdatedSpy).toHaveBeenCalledWith({
                type: 'global',
                changes: {
                    old: expect.any(Object),
                    new: expect.objectContaining(options)
                }
            });
        });
        test('should update only specified global settings', async () => {
            const originalSettings = settingsManager.getSettings();
            await settingsManager.updateGlobalAPSettings({
                maxRetries: 10
            });
            const updatedSettings = settingsManager.getSettings();
            expect(updatedSettings.maxRetries).toBe(10);
            expect(updatedSettings.defaultFrequency).toBe(originalSettings.defaultFrequency);
            expect(updatedSettings.enableLogging).toBe(originalSettings.enableLogging);
        });
    });
    describe('getEnabledAPs', () => {
        test('should return only enabled APs', async () => {
            // Disable one AP
            await settingsManager.updateIndividualAPSettings({
                IPaddress: '8.8.8.8',
                enabled: false
            });
            const enabledAPs = settingsManager.getEnabledAPs();
            expect(enabledAPs).toHaveLength(1);
            expect(enabledAPs[0].IPaddress).toBe('8.8.4.4');
            expect(enabledAPs[0].enabled).not.toBe(false);
        });
        test('should return all APs when all are enabled', () => {
            const enabledAPs = settingsManager.getEnabledAPs();
            expect(enabledAPs).toHaveLength(2);
        });
        test('should return empty array when all APs are disabled', async () => {
            await settingsManager.updateBatchSettings(['8.8.8.8', '8.8.4.4'], {
                enabled: false
            });
            const enabledAPs = settingsManager.getEnabledAPs();
            expect(enabledAPs).toHaveLength(0);
        });
    });
    describe('getStats', () => {
        test('should return correct statistics', () => {
            const stats = settingsManager.getStats();
            expect(stats).toEqual({
                total: 2,
                enabled: 2,
                disabled: 0,
                lastModified: expect.any(Date)
            });
        });
        test('should return correct statistics with mixed enabled/disabled', async () => {
            await settingsManager.updateIndividualAPSettings({
                IPaddress: '8.8.8.8',
                enabled: false
            });
            const stats = settingsManager.getStats();
            expect(stats).toEqual({
                total: 2,
                enabled: 1,
                disabled: 1,
                lastModified: expect.any(Date)
            });
        });
    });
    describe('saveData', () => {
        test('should save data successfully', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            await settingsManager.saveData();
            expect(mockedFs.writeFile).toHaveBeenCalledWith(mockDataFilePath, expect.stringContaining('export const databaseData: DatabaseData ='), 'utf8');
        });
        test('should emit error and throw when save fails', async () => {
            const saveError = new Error('Permission denied');
            mockedFs.writeFile.mockRejectedValueOnce(saveError);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            await expect(settingsManager.saveData()).rejects.toThrow('Failed to save data: Permission denied');
            expect(errorSpy).toHaveBeenCalledWith(saveError);
        });
    });
    describe('loadData', () => {
        test('should create file with default data when file does not exist', async () => {
            mockedFs.access.mockRejectedValueOnce(new Error('File not found'));
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            await settingsManager.loadData();
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
        test('should load existing data file successfully', async () => {
            const mockData = getMockDatabaseData();
            mockedFs.access.mockResolvedValueOnce(undefined);
            mockedFs.readFile.mockResolvedValueOnce('export const databaseData = {}');
            // Mock dynamic import
            const mockModule = { databaseData: mockData };
            jest.doMock(mockDataFilePath, () => mockModule, {
                virtual: true
            });
            await settingsManager.loadData();
            expect(mockedFs.readFile).toHaveBeenCalledWith(mockDataFilePath, 'utf8');
        });
        test('should emit error and throw when load fails', async () => {
            const loadError = new Error('Read permission denied');
            mockedFs.access.mockResolvedValueOnce(undefined);
            mockedFs.readFile.mockRejectedValueOnce(loadError);
            const errorSpy = jest.fn();
            settingsManager.onError(errorSpy);
            await expect(settingsManager.loadData()).rejects.toThrow('Failed to load data: Read permission denied');
            expect(errorSpy).toHaveBeenCalledWith(loadError);
        });
    });
    describe('resetToDefaults', () => {
        test('should reset to default data and emit data-loaded', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            // First modify some data
            await settingsManager.addAP({
                IPaddress: '1.1.1.1',
                frequencyToPoll: 1000,
                name: 'Test AP',
                description: 'Test'
            });
            expect(settingsManager.getAPList()).toHaveLength(3);
            const dataLoadedSpy = jest.fn();
            settingsManager.onDataLoaded(dataLoadedSpy);
            await settingsManager.resetToDefaults();
            expect(settingsManager.getAPList()).toHaveLength(2);
            expect(settingsManager.getAP('1.1.1.1')).toBeNull();
            expect(dataLoadedSpy).toHaveBeenCalledWith(expect.any(Object));
        });
    });
    describe('Edge cases and error scenarios', () => {
        test('should handle empty IP address in getAP', () => {
            const ap = settingsManager.getAP('');
            expect(ap).toBeNull();
        });
        test('should handle undefined fields in update operations', async () => {
            await settingsManager.updateIndividualAPSettings({
                IPaddress: '8.8.8.8',
                frequencyToPoll: undefined,
                timeout: undefined,
                enabled: undefined,
                name: undefined,
                description: undefined
            });
            // Should not change any values
            const ap = settingsManager.getAP('8.8.8.8');
            expect(ap?.name).toBe('Google DNS');
            expect(ap?.frequencyToPoll).toBe(5000);
        });
        test('should handle batch update with empty array', async () => {
            mockedFs.writeFile.mockResolvedValueOnce(undefined);
            const settingsUpdatedSpy = jest.fn();
            settingsManager.onSettingsUpdated(settingsUpdatedSpy);
            await settingsManager.updateBatchSettings([], {
                frequencyToPoll: 1000
            });
            expect(settingsUpdatedSpy).toHaveBeenCalledWith({
                type: 'batch',
                changes: {}
            });
        });
        test('should handle constructor with autosave disabled', async () => {
            const noAutoSaveManager = new SettingsManager('./test.ts', false);
            // Mock to avoid actual file operations
            mockedFs.writeFile.mockClear();
            await noAutoSaveManager.addAP({
                IPaddress: '1.1.1.1',
                frequencyToPoll: 1000,
                name: 'Test',
                description: 'Test'
            });
            expect(mockedFs.writeFile).not.toHaveBeenCalled();
        });
        test('should handle date conversion in loadData', async () => {
            const mockData = {
                ...getMockDatabaseData(),
                lastModified: '2023-01-01T00:00:00.000Z' // String instead of Date
            };
            mockedFs.access.mockResolvedValueOnce(undefined);
            mockedFs.readFile.mockResolvedValueOnce('export const databaseData = {}');
            const mockModule = { databaseData: mockData };
            jest.doMock(mockDataFilePath, () => mockModule, {
                virtual: true
            });
            await settingsManager.loadData();
            const stats = settingsManager.getStats();
            expect(stats.lastModified).toBeInstanceOf(Date);
        });
    });
    describe('Memory management and cleanup', () => {
        test('should clean up require cache on loadData', async () => {
            mockedFs.access.mockResolvedValueOnce(undefined);
            mockedFs.readFile.mockResolvedValueOnce('export const databaseData = {}');
            // Set up initial cache
            require.cache[mockDataFilePath] =
                {};
            await settingsManager.loadData();
            expect(require.cache[mockDataFilePath]).toBeUndefined();
        });
        test('should remove all listeners on cleanup', () => {
            settingsManager.onAPAdded(() => { });
            settingsManager.onAPRemoved(() => { });
            settingsManager.onSettingsUpdated(() => { });
            expect(settingsManager.listenerCount('ap-added')).toBe(1);
            expect(settingsManager.listenerCount('ap-removed')).toBe(1);
            expect(settingsManager.listenerCount('settings-updated')).toBe(1);
            settingsManager.removeAllListeners();
            expect(settingsManager.listenerCount('ap-added')).toBe(0);
            expect(settingsManager.listenerCount('ap-removed')).toBe(0);
            expect(settingsManager.listenerCount('settings-updated')).toBe(0);
        });
    });
});
// Helper function to create mock database data
function getMockDatabaseData() {
    return {
        globalSettings: {
            defaultTimeout: 3000,
            defaultFrequency: 5000,
            maxRetries: 3,
            enableLogging: true,
            logLevel: 'info',
            alertThreshold: 1000,
            batchSize: 10
        },
        apList: [
            {
                IPaddress: '8.8.8.8',
                frequencyToPoll: 5000,
                timeout: 3000,
                enabled: true,
                name: 'Google DNS',
                description: 'Primary Google DNS server',
                lastUpdated: new Date('2023-01-01T00:00:00.000Z')
            },
            {
                IPaddress: '8.8.4.4',
                frequencyToPoll: 5000,
                timeout: 3000,
                enabled: true,
                name: 'Google DNS Secondary',
                description: 'Secondary Google DNS server',
                lastUpdated: new Date('2023-01-01T00:00:00.000Z')
            }
        ],
        lastModified: new Date('2023-01-01T00:00:00.000Z')
    };
}
