import { AffectedDeviceDTO } from '../dtos';

// Each channel has its own room (NOT-243): a chat message lists up to 30
// names, a phone notification three, a ticket every one of them.
const CHAT_NAME_CAP = 30;
const PUSH_NAME_CAP = 3;

export class OutageMessages {
  static chatList(affected: AffectedDeviceDTO[]): string | null {
    if (affected.length === 0) return null;
    return [
      `Afectados (${affected.length}):`,
      ...OutageMessages.groupedLines(affected, CHAT_NAME_CAP)
    ].join('\n');
  }

  static pushList(affected: AffectedDeviceDTO[]): string | null {
    if (affected.length === 0) return null;
    return `Afectados (${affected.length}): ${OutageMessages.names(affected, PUSH_NAME_CAP)}`;
  }

  static ticketList(affected: AffectedDeviceDTO[]): string | null {
    if (affected.length === 0) return null;
    return [
      `Afectados (${affected.length}):`,
      ...affected.map(
        (d) =>
          `- ${OutageMessages.label(d)}${d.viaDeviceName ? ` (vía ${d.viaDeviceName})` : ''}`
      )
    ].join('\n');
  }

  // NOT-245: who came back with the root, and who is still down.
  static recoveryChat(affected: AffectedDeviceDTO[]): string | null {
    return OutageMessages.recovery(affected, CHAT_NAME_CAP);
  }

  static recoveryPush(affected: AffectedDeviceDTO[]): string | null {
    return OutageMessages.recovery(affected, PUSH_NAME_CAP);
  }

  private static recovery(
    affected: AffectedDeviceDTO[],
    cap: number
  ): string | null {
    if (affected.length === 0) return null;
    const stillDown = affected.filter((d) => d.status === 'DOWN');
    if (stillDown.length === 0) {
      return `Volvieron los ${affected.length} afectados.`;
    }
    const back = affected.length - stillDown.length;
    if (back === 0) {
      return `Siguen caídos los ${affected.length} afectados: ${OutageMessages.names(stillDown, cap)}`;
    }
    return `Volvieron ${back} de ${affected.length}. Siguen caídos: ${OutageMessages.names(stillDown, cap)}`;
  }

  private static names(
    devices: AffectedDeviceDTO[],
    cap: number
  ): string {
    const shown = devices
      .slice(0, cap)
      .map((d) => d.name)
      .join(', ');
    const rest = devices.length - cap;
    return rest > 0 ? `${shown} y ${rest} más` : shown;
  }

  private static label(d: AffectedDeviceDTO): string {
    return d.ipAddress ? `${d.name} — ${d.ipAddress}` : d.name;
  }

  // One line per device hanging straight off the root, with everything
  // behind it after an arrow: "• Switch Barrio Sur → Cliente Ruiz, …".
  private static groupedLines(
    affected: AffectedDeviceDTO[],
    cap: number
  ): string[] {
    const byId = new Map(affected.map((d) => [d.deviceId, d]));
    const topOf = (d: AffectedDeviceDTO): string => {
      let current = d;
      for (let hop = 0; hop < affected.length; hop++) {
        const via =
          current.viaDeviceId === null
            ? undefined
            : byId.get(current.viaDeviceId);
        if (via === undefined) return current.deviceId;
        current = via;
      }
      return current.deviceId;
    };

    const groups = new Map<string, AffectedDeviceDTO[]>();
    for (const d of affected) {
      const top = topOf(d);
      if (!groups.has(top)) groups.set(top, []);
      if (top !== d.deviceId) groups.get(top)!.push(d);
    }

    const lines: string[] = [];
    let shown = 0;
    for (const [top, members] of groups) {
      if (shown >= cap) break;
      const head = byId.get(top)!;
      shown++;
      const listed = members.slice(0, cap - shown);
      shown += listed.length;
      lines.push(
        listed.length === 0
          ? `• ${OutageMessages.label(head)}`
          : `• ${head.name} → ${listed.map((m) => m.name).join(', ')}`
      );
    }
    const rest = affected.length - shown;
    if (rest > 0) lines.push(`…y ${rest} más (ver panel)`);
    return lines;
  }
}
