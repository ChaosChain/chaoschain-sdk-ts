import { WalletManager } from './WalletManager';

type MandateCoreModule = {
  Mandate: new (data: Record<string, unknown>) => any;
  DEFAULT_BASE?: string;
  buildCore?: (kind: string, payload: Record<string, unknown>, baseUrl?: string) => Record<string, unknown>;
  newMandateId?: () => string;
};

function loadMandatesCore(): MandateCoreModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('mandates-core');
    const primitives = mod.primitives || mod.default?.primitives || {};
    const utils = mod.utils || mod.default?.utils || {};

    const Mandate = mod.Mandate || mod.default?.Mandate || mod;
    const DEFAULT_BASE = primitives.DEFAULT_BASE || mod.DEFAULT_BASE || mod.default?.DEFAULT_BASE;
    const buildCore =
      primitives.build_core ||
      primitives.buildCore ||
      mod.build_core ||
      mod.buildCore ||
      mod.default?.build_core ||
      mod.default?.buildCore;
    const newMandateId =
      utils.new_mandate_id ||
      utils.newMandateId ||
      mod.new_mandate_id ||
      mod.newMandateId ||
      mod.default?.new_mandate_id ||
      mod.default?.newMandateId;

    if (!Mandate || !buildCore || !newMandateId) {
      throw new Error('mandates-core exports missing (Mandate/buildCore/newMandateId)');
    }

    return {
      Mandate,
      DEFAULT_BASE,
      buildCore,
      newMandateId,
    };
  } catch (error) {
    throw new Error('mandates-core is not installed. Install with: npm i mandates-core');
  }
}

export class MandateManager {
  private readonly agentName: string;
  private readonly walletManager: WalletManager;
  private readonly agentCaip10: string;
  private readonly chainId: number;
  private readonly mandatesCore: MandateCoreModule;

  constructor(agentName: string, walletManager: WalletManager, chainId: number) {
    this.agentName = agentName;
    this.walletManager = walletManager;
    this.chainId = chainId;
    this.agentCaip10 = this.toCaip10(this.walletManager.getAddress());
    this.mandatesCore = loadMandatesCore();
    console.log(`📜 mandates-core ready (deterministic mandates) for ${this.agentName}`);
  }

  get agent_caip10(): string {
    return this.agentCaip10;
  }

  get chain_id(): number {
    return this.chainId;
  }

  private toCaip10(identifier: string): string {
    if (identifier.startsWith('eip155:')) {
      return identifier;
    }
    return `eip155:${this.chainId}:${identifier}`;
  }

  buildCore(kind: string, payload: Record<string, unknown>, baseUrl?: string): Record<string, unknown> {
    return this.mandatesCore.buildCore!(
      kind,
      payload,
      baseUrl || this.mandatesCore.DEFAULT_BASE
    );
  }

  createMandate(params: {
    intent: string;
    core: Record<string, unknown>;
    deadline: string;
    client: string;
    server?: string;
    version?: string;
    mandateId?: string;
    createdAt?: string;
  }): any {
    const {
      intent,
      core,
      deadline,
      client,
      server,
      version = '0.1.0',
      mandateId,
      createdAt,
    } = params;

    const clientCaip = this.toCaip10(client);
    const serverCaip = this.toCaip10(server || this.walletManager.getAddress());

    const Mandate = this.mandatesCore.Mandate;
    return new Mandate({
      mandateId: mandateId || this.mandatesCore.newMandateId!(),
      version,
      client: clientCaip,
      server: serverCaip,
      createdAt: createdAt || new Date().toISOString(),
      deadline,
      intent,
      core,
    });
  }

  mandateFromDict(data: any): any {
    const Mandate = this.mandatesCore.Mandate;
    if (data instanceof Mandate) {
      return data;
    }
    return new Mandate(data);
  }

  signAsServer(mandate: any, privateKey?: string): any {
    const mandateObj = this.mandateFromDict(mandate);
    const keyToUse = privateKey || this.walletManager.getPrivateKey();
    const signer = mandateObj.sign_as_server || mandateObj.signAsServer;
    const signature = signer.call(mandateObj, keyToUse);

    if (typeof mandate === 'object' && mandate !== null && !('signatures' in mandate)) {
      mandate.signatures = mandateObj.signatures;
    }
    return signature?.to_dict ? signature.to_dict() : signature;
  }

  signAsClient(mandate: any, privateKey: string): any {
    const mandateObj = this.mandateFromDict(mandate);
    const signer = mandateObj.sign_as_client || mandateObj.signAsClient;
    const signature = signer.call(mandateObj, privateKey);

    if (typeof mandate === 'object' && mandate !== null && !('signatures' in mandate)) {
      mandate.signatures = mandateObj.signatures;
    }
    return signature?.to_dict ? signature.to_dict() : signature;
  }

  verify(mandate: any): {
    client_ok: boolean;
    server_ok: boolean;
    all_ok: boolean;
    mandate_hash: string;
  } {
    const mandateObj = this.mandateFromDict(mandate);
    const verifyServer = mandateObj.verify_server || mandateObj.verifyServer;
    const verifyClient = mandateObj.verify_client || mandateObj.verifyClient;
    const computeHash = mandateObj.compute_mandate_hash || mandateObj.computeMandateHash;

    const serverOk = !!verifyServer.call(mandateObj);
    const clientOk = !!verifyClient.call(mandateObj);
    const mandateHash = computeHash.call(mandateObj);

    return {
      client_ok: clientOk,
      server_ok: serverOk,
      all_ok: clientOk && serverOk,
      mandate_hash: mandateHash,
    };
  }
}
