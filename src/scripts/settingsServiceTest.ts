import SettingsManager from '../services/settings.service';

const settingsManager = new SettingsManager();
async function example() {
  // Event listeners
  settingsManager.onDataLoaded((data) => {
    console.log('Data loaded:', data);
  });

  settingsManager.onSettingsUpdated((data) => {
    console.log('Settings updated:', data);
  });

  settingsManager.onAPAdded((ap) => {
    console.log('AP added:', ap);
  });

  settingsManager.onError((error) => {
    console.error('Settings manager error:', error.message);
  });

  try {
    // Initialize
    await settingsManager.initialize();

    // Get current settings
    console.log(
      'Get Global settings:',
      settingsManager.getSettings()
    );
    console.log('Get AP list:', settingsManager.getAPList());

    // Update individual AP
    await settingsManager.updateIndividualAPSettings({
      IPaddress: '8.8.8.8',
      frequencyToPoll: 3000,
      name: 'Updated Google DNS'
    });

    // Update all APs globally
    await settingsManager.updateGlobalAPSettings({
      defaultFrequency: 10000 // Apply to all
    });

    console.log(
      'AP List after global update:',
      settingsManager.getAPList()
    );

    // Add new AP
    await settingsManager.addAP({
      IPaddress: '1.1.1.1',
      frequencyToPoll: 2000,
      name: 'Cloudflare DNS',
      description: 'Cloudflare public DNS'
    });

    // Get stats
    console.log('Stats:', settingsManager.getStats());
  } catch (error) {
    console.error('Example error:', error);
  }
}

example();
