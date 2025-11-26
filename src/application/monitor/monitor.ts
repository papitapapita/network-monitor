import ping, { PingConfig, PingResponse } from 'ping';

//Validate the host with a regex to verify it is an ip
//const hosts = ['172.16.30.234'];

interface Options {
  hosts: string[];
  batchSize?: number;
  monitoring?: true;
  interval?: number;
  callback: (result: PingResponse) => Promise<void>;
  options?: PingConfig;
}

async function pingHosts({
  hosts,
  batchSize,
  callback,
  options
}: Options) {
  for (let i = 0; i < hosts.length; i += batchSize!) {
    const batch = hosts.slice(i, i + batchSize!);

    const results = await Promise.allSettled(
      batch.map((host) => ping.promise.probe(host, options))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        await callback(result.value);
      } else {
        console.error(
          `Error pinging host: ${batch[results.indexOf(result)]}`,
          result.reason
        );
      }
    }
  }
}

export async function checkHost({
  hosts,
  batchSize = 10,
  monitoring = true,
  interval = 15000,
  callback,
  options
}: Options) {
  if (monitoring) {
    setInterval(() => {
      pingHosts({ hosts, batchSize, callback, options });
    }, interval);
  } else {
    await pingHosts({ hosts, batchSize, callback, options });
  }
}
