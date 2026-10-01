import { readFileSync } from 'fs';
import path from 'path';
import { loadAgentSettings } from '../../src/agent/config/AgentSettings';

// The installers, the service definitions and the agent must agree on
// names and paths they each hard-code; nothing else ties them together.
const packaging = (file: string) =>
  readFileSync(
    path.resolve(__dirname, '../../packaging/agent', file),
    'utf8'
  );

describe('agent packaging', () => {
  describe('Windows', () => {
    const iss = packaging('windows/nms-agent.iss');
    const service = packaging('windows/nms-agent-service.xml');
    const windowsDataDir = loadAgentSettings(
      { ProgramData: 'C:\\ProgramData' },
      [],
      'win32'
    ).dataDir;

    it('[AGT-067] leaves the pairing key where the agent looks for it', () => {
      expect(windowsDataDir).toBe('C:\\ProgramData\\NmsAgent');
      expect(iss).toContain(
        '#define DataDir "{commonappdata}\\NmsAgent"'
      );
      expect(iss).toContain("DataDir + '\\pairing.key'");
    });

    it('[AGT-067] asks for the key only on a PC that is not paired', () => {
      expect(iss).toContain(
        "ExpandConstant('{#DataDir}\\agent.json')"
      );
      expect(iss).toMatch(/ShouldSkipPage[\s\S]*IsPaired\(\)/);
      expect(iss).toContain('{param:PAIRINGKEY|}');
    });

    it('[AGT-067] runs as a service that starts at boot and restarts on a crash', () => {
      expect(service).toContain(
        '<executable>%BASE%\\nms-agent.exe</executable>'
      );
      expect(service).toContain('<startmode>Automatic</startmode>');
      expect(service).toContain('<onfailure action="restart"');
      expect(service).not.toMatch(/<serviceaccount>/);
      expect(iss).toContain("RunHidden(Service, 'install')");
      expect(iss).toContain("RunHidden(Service, 'start')");
    });

    it('[AGT-067] keeps the PC awake and out of Defender’s way', () => {
      expect(iss).toContain('/change standby-timeout-ac 0');
      expect(iss).toContain('Add-MpPreference -ExclusionPath');
    });

    it('[AGT-067] locks the data folder to SYSTEM and administrators', () => {
      expect(iss).toContain(
        '/inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F'
      );
    });

    it('[AGT-067] uninstalling removes the service, the exclusion and every file the agent kept', () => {
      expect(iss).toMatch(/\[UninstallRun\][\s\S]*"uninstall"/);
      expect(iss).toContain('Remove-MpPreference');
      expect(iss).toMatch(
        /\[UninstallDelete\][\s\S]*filesandordirs; Name: "\{#DataDir\}"/
      );
    });

    it('[AGT-067] leaves no rollback copy or half-swapped download behind, on reinstall or uninstall', () => {
      for (const section of ['InstallDelete', 'UninstallDelete']) {
        const body = iss.split(`[${section}]`)[1].split('\n[')[0];
        expect(body).toContain('{app}\\nms-agent.exe.old');
        expect(body).toContain('{app}\\nms-agent.exe.new');
      }
    });
  });

  describe('Linux', () => {
    const unit = packaging('linux/nms-agent.service');
    const install = packaging('linux/install.sh');
    const uninstall = packaging('linux/uninstall.sh');
    const linuxDataDir = loadAgentSettings({}, [], 'linux').dataDir;

    it('[AGT-068] the unit, the installer and the agent agree on the data directory', () => {
      expect(linuxDataDir).toBe('/var/lib/nms-agent');
      expect(unit).toContain(`NMS_AGENT_DATA_DIR=${linuxDataDir}`);
      expect(unit).toContain('StateDirectory=nms-agent');
      expect(install).toContain(`DATA_DIR=${linuxDataDir}`);
    });

    it('[AGT-068] runs the installed binary as its own user, restarting on a crash', () => {
      expect(install).toContain('/opt/nms-agent/nms-agent');
      expect(unit).toContain('ExecStart=/opt/nms-agent/nms-agent');
      expect(unit).toContain('User=nms-agent');
      expect(unit).toContain('Restart=always');
      expect(unit).toContain('WantedBy=multi-user.target');
    });

    it('[AGT-068] keeps the data directory private to the agent', () => {
      expect(unit).toContain('StateDirectoryMode=0700');
      expect(install).toContain('umask 077');
    });

    it('[AGT-068] lets the agent replace its own binary and nothing else outside its data', () => {
      expect(install).toContain(
        'install -d -m 0755 -o nms-agent -g nms-agent /opt/nms-agent'
      );
      expect(install).toContain(
        'install -m 0755 -o nms-agent -g nms-agent "$HERE/nms-agent" /opt/nms-agent/nms-agent'
      );
      expect(unit).toContain('ProtectSystem=strict');
      expect(unit).toContain('ReadWritePaths=/opt/nms-agent');
    });

    it('[AGT-068] does not set NoNewPrivileges, which would stop ping', () => {
      expect(unit).not.toMatch(/^NoNewPrivileges/m);
    });

    it('[AGT-068] uninstalling removes the service and every file the agent kept', () => {
      expect(uninstall).toContain(
        'systemctl disable --now nms-agent'
      );
      expect(uninstall).toContain(
        'rm -rf /opt/nms-agent /var/lib/nms-agent'
      );
    });
  });
});
