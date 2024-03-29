import fetch from "cross-fetch";
import { json, response } from "express";
import { createContext } from "react";

import {
  Bin,
  RestOperation,
  CallableRestOperation,
  NextBin,
  Problem,
  Sku,
  SearchResults,
  NextSku,
  NextBatch,
  Batch,
  ApiStatus,
  Status,
} from "./data-models";

export interface FrontloadContext {
  api: ApiClient;
}

/**
 * Inventorius API client
 */
export class ApiClient {
  hostname: string;


  constructor(hostname = "") {
    this.hostname = hostname;
  }


  hydrate<T extends Sku | Batch>(server_rendered: T): T {
    if (Object.getPrototypeOf(server_rendered) !== Object.prototype)
      return server_rendered;
    switch (server_rendered.kind) {
    case "sku":
      Object.setPrototypeOf(server_rendered, Sku.prototype);
      break;
    case "batch":
      Object.setPrototypeOf(server_rendered, Batch.prototype);
      break;
    default:
        let _exhaustive_check: never; // eslint-disable-line
    }
    for (const key in server_rendered.operations) {
      Object.setPrototypeOf(
        server_rendered.operations[key],
        CallableRestOperation.prototype
      );
      server_rendered.operations[key].hostname = this.hostname;
    }
    return server_rendered;
  }


  async getStatus(): Promise<ApiStatus> {
    const resp = await fetch(`${this.hostname}/api/status`);
    if (!resp.ok) throw Error(`${this.hostname}/api/status returned error code`);
    return new ApiStatus({ ... await resp.json(), hostname: this.hostname });
  }


  async getNextBin(): Promise<NextBin> {
    const resp = await fetch(`${this.hostname}/api/next/bin`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/bin returned error status`);
    return new NextBin({ ...json, hostname: this.hostname });
  }


  async getNextSku(): Promise<NextSku> {
    const resp = await fetch(`${this.hostname}/api/next/sku`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextSku({ ...json, hostname: this.hostname });
  }


  async getNextBatch(): Promise<NextBatch> {
    const resp = await fetch(`${this.hostname}/api/next/batch`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextBatch({ ...json, hostname: this.hostname });
  }


  async getSearchResults(params: {
    query: string;
    limit?: string;
    startingFrom?: string;
  }): Promise<SearchResults | Problem> {
    const resp = await fetch(
      `${this.hostname}/api/search?${new URLSearchParams(params).toString()}`
    );
    const json = await resp.json();

    if (resp.ok) return new SearchResults({ ...json });
    else return { ...json, kind: "problem" };
  }


  async getBin(id: string): Promise<Bin | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${id}`);
    const json = await resp.json();

    if (resp.ok) return new Bin({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createBin({ id, props }: { id: string; props?: unknown }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bins`, {
      method: "POST",
      body: JSON.stringify({ id, props }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async getSku(id: string): Promise<Sku | Problem> {
    const resp = await fetch(`${this.hostname}/api/sku/${id}`);
    const json = await resp.json();
    if (resp.ok) return new Sku({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createSku(params: {
    id: string;
    name: string;
    props?: unknown;
    owned_codes?: string[];
    associated_codes?: string[];
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/skus`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async getBatch(batch_id: string): Promise<Batch | Problem> {
    const resp = await fetch(`${this.hostname}/api/batch/${batch_id}`);
    const json = await resp.json();
    if (resp.ok) return new Batch({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createBatch(params: {
    id: string;
    sku_id?: string;
    name?: string;
    owned_codes?: string[];
    associated_codes?: string[];
    props?: unknown;
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/batches`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async receive({
    into_id,
    item_id,
    quantity,
  }: {
    into_id: string;
    item_id: string;
    quantity: number;
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${into_id}/contents`, {
      method: "POST",
      body: JSON.stringify({
        id: item_id,
        quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }

  async release({ from_id, item_id, quantity }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${from_id}/contents`, {
      method: "POST",
      body: JSON.stringify({
        id: item_id,
        quantity: -quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return {...json, kind: "status"};
    } else {
      return {...json, kind: "problem"};
    }
  }

  async move({ from_id, to_id, item_id, quantity }): Promise < Status | Problem > {
    const resp = await fetch(`${this.hostname}/api/bin/${from_id}/contents/move`, {
      method: "PUT",
      body: JSON.stringify({
        id: item_id,
        destination: to_id,
        quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      }
    });
    const json = await resp.json();
    if(resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }
}

// Do not use this on the server side! Use react-frontload.
export const ApiContext = createContext<ApiClient>(new ApiClient(""));
