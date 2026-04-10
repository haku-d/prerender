import fp from "fastify-plugin";
import { parseStringPromise } from "xml2js";
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { minify } from 'html-minifier-terser';
import { md5 } from "../utils/hash";
import { fastifySchedule } from '@fastify/schedule';
import { SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import * as puppeteer from "puppeteer-core";

interface IPluginOptions {}

export default fp<IPluginOptions>(async (fastify, opts) => {

  fastify.register(fastifySchedule);

  const saveToFile = async (url: string, content: string) => {
    const filename = `${md5(url)}.html`
    const savePath = path.join(fastify.config.STATIC_SITE_DIR, filename);
    const minified = await minify(content, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
    });
    await writeFile(savePath, minified, 'utf-8');
    fastify.log.info(`Saved minified file to ${savePath} (${content.length} → ${minified.length} bytes)`);
  }

  const fetchSiteMap = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { trim: true });
    const urls = parsed.urlset.url.map((entry: any) => entry.loc[0]);
    return urls;
  };

  const distributeEvenly = (numberOfRecipients: number, totalAmount: number) => {
    const min = totalAmount / numberOfRecipients;
    const remainder = totalAmount % numberOfRecipients;
    return Array(numberOfRecipients)
      .fill(0)
      .map((_, idx) => min + (idx < remainder ? 1 : 0));
  };

  // Shared browser instance kept alive for on-demand rendering
  let sharedBrowser: puppeteer.Browser | null = null;

  // In-flight map to deduplicate concurrent renders for the same URL
  const inFlight = new Map<string, Promise<string>>();

  const renderSingleUrl = async (page: puppeteer.Page, fullUrl: string): Promise<string> => {
    await page.setCacheEnabled(false);
    await page.goto(`${fullUrl}?t=${Date.now()}`, {
      waitUntil: "networkidle0",
      timeout: 15000 // 15s
    });
    await page.waitForFunction(() => {
      const meta = document.querySelector('meta[name="title"]');
      const content = meta?.getAttribute('content');
      return (content ?? '').trim().length > 0;
    });
    const metaTitle = await page.$eval('meta[name="title"]', el => el.getAttribute('content'));
    fastify.log.info(`Meta title: ${metaTitle}`);
    await page.evaluate(() => {
      const formatPrice = (selector: string) => {
        const el = document.querySelector(selector);
        if (el) {
          const match = el.textContent?.match(/[\d.]+/);
          if (match) {
            const num = parseFloat(match[0]);
            el.textContent = `$${num.toFixed(2)}`;
          }
        }
      };
      formatPrice('#total_price_span');
      formatPrice('#spn_unit_price');
    });
    return page.content();
  };

  fastify.decorate('renderUrl', async (relativeUrl: string): Promise<string> => {
    const fullUrl = `${fastify.config.SITE_URL}${relativeUrl}`;

    if (inFlight.has(fullUrl)) {
      fastify.log.info(`Awaiting in-flight render for ${fullUrl}`);
      return inFlight.get(fullUrl)!;
    }

    const renderPromise = (async () => {
      if (!sharedBrowser) throw new Error('Shared browser is not initialized');
      const context = await sharedBrowser.createBrowserContext();
      const page = await context.newPage();
      try {
        fastify.log.info(`Live rendering ${fullUrl}`);
        const content = await renderSingleUrl(page, fullUrl);
        if (!fs.existsSync(fastify.config.STATIC_SITE_DIR)) {
          fs.mkdirSync(fastify.config.STATIC_SITE_DIR, { recursive: true });
        }
        await saveToFile(fullUrl, content);
        return content;
      } finally {
        await page.close();
        await context.close();
        inFlight.delete(fullUrl);
      }
    })();

    inFlight.set(fullUrl, renderPromise);
    return renderPromise;
  });

  const task = new AsyncTask(
    'Prerender gotoprint.ca',
    async () => {
      if (!fs.existsSync(fastify.config.STATIC_SITE_DIR)) {
        fs.mkdirSync(fastify.config.STATIC_SITE_DIR, { recursive: true });
      }

      const sitemapUrl = `${fastify.config.SITE_URL}/sitemap.xml`;
      const urls = await fetchSiteMap(sitemapUrl);
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: fastify.config.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const copyOfUrl = [...urls];
      const pages: puppeteer.Page[] = [];
      const maxConcurrency = 3;
      let context: puppeteer.BrowserContext | null = null;

      try {
        context = await browser.createBrowserContext();
        for (let i = 0; i < maxConcurrency; i++) {
          pages.push(await context.newPage());
        }
      } catch(err) {
        fastify.log.error(`Failed to create browser context: ${err instanceof Error ? err.message : err}`);
      }

      if (pages.length === 0) {
        throw new Error("pages failed");
      }

      const urlDistributed = distributeEvenly(
        pages.length,
        urls.length
      );

      // Pre-distribute URLs to avoid race conditions during concurrent processing
      const urlBatches: string[][] = [];
      for (let i = 0; i < pages.length; i++) {
        const count = urlDistributed[i];
        urlBatches.push(copyOfUrl.splice(0, count));
      }

      return Promise.all(
        pages.map(async (page, idx) => {
          const siteUrls = urlBatches[idx];
          for (const url of siteUrls) {
            fastify.log.info(`Getting content of ${url}`);
            try {
              const content = await renderSingleUrl(page, url);
              await saveToFile(url, content);
            } catch (err: any) {
              fastify.log.info(`Skip: ${err.message}`)
            }
          }
        })
      ).finally(async () => {
        await Promise.all(pages.map((page) => page.close()));
        if (context) {
          await context.close();
        }
        await browser.close();
        fastify.log.info(`Finished rendering for ${urls.length} pages`);
      });
    },
    (err: any) => {
      fastify.log.error(err.message);
    }
  );

  // every 12 hours
  const job = new SimpleIntervalJob({ seconds: 43200, runImmediately: fastify.config.EXECUTE_JOB_ON_START ?? false }, task)

  fastify.addHook("onReady", async () => {
    sharedBrowser = await puppeteer.launch({
      headless: true,
      executablePath: fastify.config.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    fastify.scheduler.addSimpleIntervalJob(job);
  });

  fastify.addHook('onClose', async () => {
    if (sharedBrowser) {
      await sharedBrowser.close();
    }
  });
});
