import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { CACHE, config, log } from './util.ts';

// Respeita HTTPS_PROXY/NO_PROXY quando existirem (o fetch nativo do Node ignora).
if (process.env.HTTPS_PROXY || process.env.https_proxy) setGlobalDispatcher(new EnvHttpProxyAgent());

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const RESOURCES = 'https://resources.download.minecraft.net';
const ADOPTIUM = 'https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jdk/hotspot/normal/eclipse';

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return (await res.json()) as T;
}

async function download(url: string, dest: string, sha1?: string) {
  if (fs.existsSync(dest) && (!sha1 || sha1File(dest) === sha1)) return;
  log('download', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha1) {
    const got = crypto.createHash('sha1').update(buf).digest('hex');
    if (got !== sha1) throw new Error(`SHA1 inválido para ${url}: ${got} != ${sha1}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

function sha1File(file: string) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

export interface Downloaded {
  dir: string;
  clientJar: string;
  serverJar: string;
  ptBr: string;
  versionJson: any;
}

export async function downloadVersion(): Promise<Downloaded> {
  const version = config.minecraftVersion;
  const dir = path.join(CACHE, version);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = await fetchJson<{ versions: { id: string; url: string }[] }>(MANIFEST);
  const entry = manifest.versions.find((v) => v.id === version);
  if (!entry) throw new Error(`Versão ${version} não existe no manifesto da Mojang`);
  const versionJson = await fetchJson(entry.url);
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify(versionJson, null, 2));

  const clientJar = path.join(dir, 'client.jar');
  const serverJar = path.join(dir, 'server.jar');
  await download(versionJson.downloads.client.url, clientJar, versionJson.downloads.client.sha1);
  await download(versionJson.downloads.server.url, serverJar, versionJson.downloads.server.sha1);

  const assetIndex = await fetchJson<{ objects: Record<string, { hash: string }> }>(versionJson.assetIndex.url);
  const pt = assetIndex.objects['minecraft/lang/pt_br.json'];
  if (!pt) throw new Error('pt_br.json não encontrado no assetIndex');
  const ptBr = path.join(dir, 'pt_br.json');
  await download(`${RESOURCES}/${pt.hash.slice(0, 2)}/${pt.hash}`, ptBr, pt.hash);
  return { dir, clientJar, serverJar, ptBr, versionJson };
}

function javaMajor(bin: string): number {
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  if (r.error) return 0;
  const m = /version "(\d+)/.exec(r.stderr + r.stdout);
  return m ? Number(m[1]) : 0;
}

/** Garante um Java >= versão exigida pelo jar (26.x exige Java 25). */
export async function ensureJava(required: number): Promise<string> {
  if (process.env.JAVA_HOME) {
    const bin = path.join(process.env.JAVA_HOME, 'bin/java');
    if (javaMajor(bin) >= required) return bin;
  }
  if (javaMajor('java') >= required) return 'java';
  const jdkDir = path.join(CACHE, `jdk-${required}`);
  const find = () => {
    if (!fs.existsSync(jdkDir)) return undefined;
    for (const d of fs.readdirSync(jdkDir)) {
      const bin = path.join(jdkDir, d, 'bin/java');
      if (fs.existsSync(bin)) return bin;
    }
    return undefined;
  };
  let bin = find();
  if (!bin) {
    if (process.platform !== 'linux') {
      throw new Error(`Instale o Java ${required}+ (ou defina JAVA_HOME) para rodar o data generator.`);
    }
    log('java', `Java ${required} não encontrado, baixando Temurin ${required}`);
    const tgz = path.join(CACHE, `jdk-${required}.tar.gz`);
    await download(ADOPTIUM, tgz);
    fs.mkdirSync(jdkDir, { recursive: true });
    execFileSync('tar', ['xzf', tgz, '-C', jdkDir]);
    bin = find();
  }
  if (!bin || javaMajor(bin) < required) throw new Error(`Falha ao preparar o Java ${required}`);
  return bin;
}

/** Roda o data generator oficial e devolve a pasta generated/. */
export function runDataGenerator(java: string, serverJar: string, dir: string): string {
  const out = path.join(dir, 'datagen');
  const reports = path.join(out, 'generated/reports/registries.json');
  if (fs.existsSync(reports)) return path.join(out, 'generated');
  fs.mkdirSync(out, { recursive: true });
  log('datagen', 'rodando net.minecraft.data.Main --reports --server');
  const r = spawnSync(java, ['-DbundlerMainClass=net.minecraft.data.Main', '-jar', serverJar, '--reports', '--server'], {
    cwd: out,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (r.status !== 0 || !fs.existsSync(reports)) throw new Error('Data generator falhou');
  return path.join(out, 'generated');
}
