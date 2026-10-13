/**
 * AURAXIS X20 - Real Physical Web Bluetooth & Hardware Driver Engine
 * 
 * Interacts directly with genuine physical Bluetooth Low Energy (BLE) and Serial hardware:
 * - Nordic Semiconductor UART Service (NUS) - ESP32, nRF52, Gold Radar X20 BLE
 * - HM-10 / CC2540 / CC2541 / AT-09 Bluetooth Serial Modules
 * - HC-05 / HC-06 Bluetooth SPP modules via Web Bluetooth RFCOMM / BLE bridge
 * - Web Serial API for physical USB OTG CH340 / CP2102 cables
 */

export interface TelemetryPacket {
  adc: number;
  phase: number;
  heading?: number;
  ax?: number;
  ay?: number;
  az?: number;
  tiltAngle?: number;
  isMotionArtifact?: boolean;
  timestamp: number;
}

export interface RawLogEntry {
  id: string;
  timestamp: number;
  direction: 'RX' | 'TX' | 'SYS';
  text: string;
  hex?: string;
}

export interface HardwareState {
  isConnected: boolean;
  connectionType: 'BLE' | 'USB_SERIAL' | 'NONE';
  deviceName: string | null;
  deviceId: string | null;
  rssi: number | null;
  batteryPercent: number | null;
  packetCount: number;
  packetsPerSecond: number;
  bytesReceived: number;
  lastPacketTime: number;
  statusText: string;
}

// Known GATT Service & Characteristic UUIDs for hardware sensors
const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDic_TX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify from device
const NORDIC_RX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to device

const HM10_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const HM10_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const BATTERY_LEVEL_CHAR = '00002a19-0000-1000-8000-00805f9b34fb';

class BluetoothHardwareEngine {
  private device: any = null;
  private gattServer: any = null;
  private rxCharacteristic: any = null;
  private txCharacteristic: any = null;

  // Web Serial handles
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;

  // Stream Buffers
  private incomingBuffer: string = '';
  private textDecoder = new TextDecoder('utf-8');
  private textEncoder = new TextEncoder();

  // Rate tracking
  private recentPacketsTimestamps: number[] = [];
  private rateInterval: any = null;

  // Listeners
  private telemetryCallbacks: Set<(data: TelemetryPacket) => void> = new Set();
  private logCallbacks: Set<(log: RawLogEntry) => void> = new Set();
  private stateCallbacks: Set<(state: HardwareState) => void> = new Set();

  public state: HardwareState = {
    isConnected: false,
    connectionType: 'NONE',
    deviceName: null,
    deviceId: null,
    rssi: null,
    batteryPercent: null,
    packetCount: 0,
    packetsPerSecond: 0,
    bytesReceived: 0,
    lastPacketTime: 0,
    statusText: 'قطع ارتباط (Disconnected)'
  };

  constructor() {
    this.startRateMonitor();
  }

  public isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public onTelemetry(cb: (data: TelemetryPacket) => void) {
    this.telemetryCallbacks.add(cb);
    return () => this.telemetryCallbacks.delete(cb);
  }

  public onRawLog(cb: (log: RawLogEntry) => void) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  public onStateChange(cb: (state: HardwareState) => void) {
    this.stateCallbacks.add(cb);
    cb(this.state);
    return () => this.stateCallbacks.delete(cb);
  }

  private emitState() {
    const copy = { ...this.state };
    this.stateCallbacks.forEach((cb) => cb(copy));
  }

  private addLog(direction: 'RX' | 'TX' | 'SYS', text: string, hex?: string) {
    const entry: RawLogEntry = {
      id: Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
      direction,
      text,
      hex
    };
    this.logCallbacks.forEach((cb) => cb(entry));
  }

  private startRateMonitor() {
    if (this.rateInterval) clearInterval(this.rateInterval);
    this.rateInterval = setInterval(() => {
      const now = Date.now();
      this.recentPacketsTimestamps = this.recentPacketsTimestamps.filter((t) => now - t <= 1000);
      const pps = this.recentPacketsTimestamps.length;
      if (this.state.packetsPerSecond !== pps) {
        this.state.packetsPerSecond = pps;
        this.emitState();
      }
    }, 500);
  }

  /**
   * Request and connect to physical Bluetooth device using Web Bluetooth API
   */
  public async connectPhysicalBle(): Promise<boolean> {
    if (!this.isWebBluetoothSupported()) {
      const msg = 'مرورگر شما از Web Bluetooth API پشتیبانی نمی‌کند. لطفاً از گوگل کروم یا اج در اندروید/ویندوز استفاده کنید.';
      this.addLog('SYS', msg);
      throw new Error(msg);
    }

    try {
      this.addLog('SYS', 'در حال فراخوانی دیالوگ اسکن بلوتوث سخت‌افزاری...');
      this.state.statusText = 'در حال جستجوی دستگاه فیزیکی...';
      this.emitState();

      // Request Bluetooth device with all common radar & sensor service UUIDs
      const navBt = (navigator as any).bluetooth;
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          NORDIC_UART_SERVICE,
          HM10_SERVICE,
          BATTERY_SERVICE,
          'generic_access',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb'
        ]
      });

      if (!device) {
        throw new Error('هیچ دستگاهی انتخاب نشد');
      }

      this.device = device;
      this.state.deviceName = device.name || 'دستگاه سنسور ناشناس';
      this.state.deviceId = device.id;
      this.addLog('SYS', `دستگاه انتخاب شد: ${this.state.deviceName} (${device.id})`);

      // Add physical disconnect event listener
      device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect('ارتباط فیزیکی بلوتوث از سمت دستگاه قطع شد.');
      });

      this.state.statusText = 'در حال اتصال به سرور GATT...';
      this.emitState();

      const server = await device.gatt.connect();
      this.gattServer = server;
      this.addLog('SYS', 'اتصال GATT Server برقرار شد. در حال شناسایی سرویس‌ها...');

      // Discover primary UART / Serial Services
      let notifyChar: any = null;
      let writeChar: any = null;

      // 1. Try Nordic UART Service first
      try {
        const nusService = await server.getPrimaryService(NORDIC_UART_SERVICE);
        notifyChar = await nusService.getCharacteristic(NORDic_TX_CHAR);
        try {
          writeChar = await nusService.getCharacteristic(NORDIC_RX_CHAR);
        } catch {
          // write char optional
        }
        this.addLog('SYS', 'پروتکل Nordic UART Service (NUS) با موفقیت فعال شد.');
      } catch {
        this.addLog('SYS', 'سرویس NUS یافت نشد، در حال تست پروتکل HM-10 / CC2541...');
      }

      // 2. Try HM-10 Service if NUS not found
      if (!notifyChar) {
        try {
          const hm10Service = await server.getPrimaryService(HM10_SERVICE);
          notifyChar = await hm10Service.getCharacteristic(HM10_CHAR);
          writeChar = notifyChar; // HM-10 characteristic supports both Read/Write/Notify
          this.addLog('SYS', 'پروتکل سریال HM-10 / CC2541 با موفقیت فعال شد.');
        } catch {
          this.addLog('SYS', 'سرویس HM-10 یافت نشد.');
        }
      }

      // 3. Fallback: inspect all services and find any characteristic supporting notifications
      if (!notifyChar) {
        this.addLog('SYS', 'در حال اسکن کلیه سرویس‌ها برای یافتن کانال داده...');
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.notify || c.properties.indicate) {
              notifyChar = c;
              if (c.properties.write || c.properties.writeWithoutResponse) {
                writeChar = c;
              }
              this.addLog('SYS', `کانال اعلان بر روی مشخصه ${c.uuid} پیدا شد.`);
              break;
            }
          }
          if (notifyChar) break;
        }
      }

      if (!notifyChar) {
        throw new Error('دستگاه انتخاب‌شده فاقد مشخصه ارسال داده (GATT Notify) است.');
      }

      this.txCharacteristic = notifyChar;
      this.rxCharacteristic = writeChar;

      // Start Real-Time Notifications
      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
        this.handleBleCharacteristicValueChanged(event);
      });

      // Optional: Read Battery level
      try {
        const battService = await server.getPrimaryService(BATTERY_SERVICE);
        const battChar = await battService.getCharacteristic(BATTERY_LEVEL_CHAR);
        const battVal = await battChar.readValue();
        this.state.batteryPercent = battVal.getUint8(0);
        this.addLog('SYS', `سطح باتری سنسور فیزیکی: ${this.state.batteryPercent}%`);
      } catch {
        // Battery service is optional
      }

      this.state.isConnected = true;
      this.state.connectionType = 'BLE';
      this.state.statusText = `متصل به بلوتوث فیزیکی (${this.state.deviceName})`;
      this.state.rssi = -55; // Initial baseline
      this.emitState();
      this.addLog('SYS', 'جریان داده‌های زنده سنسور با موفقیت متصل و همگام شد.');

      return true;
    } catch (err: any) {
      this.handleDisconnect(`خطا در اتصال بلوتوث: ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Handle incoming BLE data packets
   */
  private handleBleCharacteristicValueChanged(event: any) {
    const valueView: DataView = event.target.value;
    const byteLength = valueView.byteLength;
    this.state.bytesReceived += byteLength;
    this.state.lastPacketTime = Date.now();

    // Convert to Uint8Array and string
    const uint8 = new Uint8Array(valueView.buffer, valueView.byteOffset, byteLength);
    const chunkText = this.textDecoder.decode(uint8);

    // Format Hex for tactical terminal display
    const hex = Array.from(uint8)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    this.incomingBuffer += chunkText;

    // Split complete packets by line delimiters (\n or \r or ;)
    let newlineIndex: number;
    while ((newlineIndex = this.incomingBuffer.search(/[\r\n;]/)) !== -1) {
      const line = this.incomingBuffer.slice(0, newlineIndex).trim();
      this.incomingBuffer = this.incomingBuffer.slice(newlineIndex + 1);

      if (line.length > 0) {
        this.processPacketLine(line, hex);
      }
    }

    // Safety buffer limit
    if (this.incomingBuffer.length > 2048) {
      this.incomingBuffer = this.incomingBuffer.slice(-512);
    }
  }

  /**
   * Process a clean delimited packet line from the hardware
   */
  private processPacketLine(rawLine: string, hex?: string) {
    this.state.packetCount++;
    this.recentPacketsTimestamps.push(Date.now());
    this.addLog('RX', rawLine, hex);

    const parsed = this.parseSensorString(rawLine);
    if (parsed) {
      this.telemetryCallbacks.forEach((cb) => cb(parsed));
    }
  }

  /**
   * Parse various geophysical & OKM packet standards:
   * 1. $OKM,adc,phase,heading*chk
   * 2. $RADAR,adc,phase,ax,ay,az*chk
   * 3. CSV: "524, 12" or "524"
   * 4. Raw ADC single values
   */
  public parseSensorString(line: string): TelemetryPacket | null {
    const clean = line.replace(/[*#].*$/, '').trim(); // Strip checksum

    // Protocol 1: $OKM or $RADAR NMEA sentences
    if (clean.startsWith('$OKM') || clean.startsWith('$RADAR')) {
      const parts = clean.split(',');
      if (parts.length >= 3) {
        const adc = parseInt(parts[1], 10) || 512;
        const phase = parseInt(parts[2], 10) || 0;
        const heading = parts[3] ? parseFloat(parts[3]) : undefined;
        const ax = parts[4] ? parseFloat(parts[4]) : undefined;
        const ay = parts[5] ? parseFloat(parts[5]) : undefined;
        const az = parts[6] ? parseFloat(parts[6]) : undefined;

        let tiltAngle = 0;
        let isMotionArtifact = false;
        if (ax !== undefined && ay !== undefined && az !== undefined) {
          const norm = Math.sqrt(ax * ax + ay * ay + az * az);
          if (norm > 0.1) {
            tiltAngle = Number((Math.acos(Math.min(1.0, Math.abs(az) / norm)) * (180 / Math.PI)).toFixed(1));
          }
          isMotionArtifact = tiltAngle > 28 || Math.abs(norm - 9.81) > 3.8;
        }

        return {
          adc: Math.max(0, Math.min(1023, adc)),
          phase,
          heading,
          ax,
          ay,
          az,
          tiltAngle,
          isMotionArtifact,
          timestamp: Date.now()
        };
      }
    }

    // Protocol 2: Comma separated "adc, phase" (e.g. "614, -8")
    if (clean.includes(',')) {
      const parts = clean.split(',').map((p) => p.trim());
      const adc = parseInt(parts[0], 10);
      const phase = parseInt(parts[1], 10) || 0;
      if (!isNaN(adc)) {
        return {
          adc: Math.max(0, Math.min(1023, adc)),
          phase,
          timestamp: Date.now()
        };
      }
    }

    // Protocol 3: Single integer ADC value (e.g. "720")
    const singleAdc = parseInt(clean, 10);
    if (!isNaN(singleAdc) && singleAdc >= 0 && singleAdc <= 4095) {
      // Normalize 12-bit (0-4095) to 10-bit (0-1023) if needed
      const normalizedAdc = singleAdc > 1023 ? Math.round(singleAdc / 4) : singleAdc;
      return {
        adc: normalizedAdc,
        phase: 0,
        timestamp: Date.now()
      };
    }

    return null;
  }

  /**
   * Connect via physical USB OTG cable using Web Serial API
   */
  public async connectPhysicalUsbSerial(baudRate = 115200): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      const msg = 'مرورگر شما از Web Serial API پشتیبانی نمی‌کند. لطفاً از Chrome یا Edge استفاده کنید.';
      this.addLog('SYS', msg);
      throw new Error(msg);
    }

    try {
      this.addLog('SYS', `در حال درخواست درگاه سریال USB با نرخ ${baudRate} bps...`);
      const navSerial = (navigator as any).serial;
      const port = await navSerial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.state.isConnected = true;
      this.state.connectionType = 'USB_SERIAL';
      this.state.deviceName = `پورت سریال USB (${baudRate} bps)`;
      this.state.statusText = `متصل با کابل USB OTG (${baudRate} bps)`;
      this.emitState();
      this.addLog('SYS', 'پورت سریال فیزیکی با موفقیت باز شد.');

      // Start continuous reader
      this.readUsbSerialStream();
      return true;
    } catch (err: any) {
      this.handleDisconnect(`خطا در اتصال کابل سریال: ${err?.message || err}`);
      throw err;
    }
  }

  private async readUsbSerialStream() {
    if (!this.serialPort || !this.serialPort.readable) return;
    try {
      this.serialReader = this.serialPort.readable.getReader();
      while (this.state.isConnected && this.serialReader) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value) {
          const byteLength = value.byteLength;
          this.state.bytesReceived += byteLength;
          this.state.lastPacketTime = Date.now();
          const chunkText = this.textDecoder.decode(value);
          this.incomingBuffer += chunkText;

          let newlineIndex: number;
          while ((newlineIndex = this.incomingBuffer.search(/[\r\n;]/)) !== -1) {
            const line = this.incomingBuffer.slice(0, newlineIndex).trim();
            this.incomingBuffer = this.incomingBuffer.slice(newlineIndex + 1);
            if (line.length > 0) {
              this.processPacketLine(line);
            }
          }
        }
      }
    } catch (err: any) {
      this.handleDisconnect(`جریان داده سریال قطع شد: ${err?.message || err}`);
    }
  }

  /**
   * Send a physical ASCII command to the connected hardware (e.g. TARE, PING, POLL)
   */
  public async sendCommand(commandText: string): Promise<boolean> {
    const formatted = commandText.endsWith('\n') ? commandText : commandText + '\n';
    this.addLog('TX', formatted.trim());

    try {
      if (this.state.connectionType === 'BLE' && this.rxCharacteristic) {
        const data = this.textEncoder.encode(formatted);
        if (this.rxCharacteristic.writeValueWithoutResponse) {
          await this.rxCharacteristic.writeValueWithoutResponse(data);
        } else {
          await this.rxCharacteristic.writeValue(data);
        }
        return true;
      }

      if (this.state.connectionType === 'USB_SERIAL' && this.serialPort?.writable) {
        if (!this.serialWriter) {
          this.serialWriter = this.serialPort.writable.getWriter();
        }
        await this.serialWriter.write(this.textEncoder.encode(formatted));
        return true;
      }

      this.addLog('SYS', 'خطا: سخت‌افزار برای ارسال دستور متصل نیست.');
      return false;
    } catch (err: any) {
      this.addLog('SYS', `خطا در ارسال دستور: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Cleanly disconnect hardware
   */
  public async disconnectHardware() {
    this.handleDisconnect('ارتباط سخت‌افزاری توسط کاربر قطع شد.');
  }

  private handleDisconnect(reason: string) {
    if (this.gattServer?.connected) {
      try {
        this.gattServer.disconnect();
      } catch {}
    }
    this.gattServer = null;
    this.device = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;

    if (this.serialReader) {
      try {
        this.serialReader.cancel();
        this.serialReader.releaseLock();
      } catch {}
      this.serialReader = null;
    }
    if (this.serialWriter) {
      try {
        this.serialWriter.releaseLock();
      } catch {}
      this.serialWriter = null;
    }
    if (this.serialPort) {
      try {
        this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }

    this.state.isConnected = false;
    this.state.connectionType = 'NONE';
    this.state.deviceName = null;
    this.state.deviceId = null;
    this.state.rssi = null;
    this.state.packetsPerSecond = 0;
    this.state.statusText = 'قطع ارتباط (Disconnected)';
    this.emitState();
    this.addLog('SYS', reason);
  }
}

export const bluetoothHardware = new BluetoothHardwareEngine();
