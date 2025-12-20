import { Client } from "discord.js";
import express, { Express, Request, Response } from "express";
import path from "path";
import { config } from "../utils/config";
import { PatreonService } from "./patreon";

const DEFAULT_PORT = 4123;
const WEBHOOK_BASE_URL = "https://music-bot.checkleaked.com";

/**
 * WebhookServer - Express server for handling Patreon webhooks
 */
export class WebhookServer {
  private static instance: WebhookServer;
  private app: Express | null = null;
  private server: any = null;
  private port: number = DEFAULT_PORT;
  private discordClient: Client | null = null;

  private constructor() {}

  public static getInstance(): WebhookServer {
    if (!this.instance) {
      this.instance = new WebhookServer();
    }
    return this.instance;
  }

  /**
   * Set the Discord client for generating invite links
   */
  public setClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Check if the server is running
   */
  public isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get the current port
   */
  public getPort(): number {
    return this.port;
  }

  /**
   * Start the webhook server
   */
  public start(port: number = DEFAULT_PORT): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      if (this.server) {
        resolve({ success: false, message: `Server is already running on port ${this.port}` });
        return;
      }

      this.port = port;
      this.app = express();

      // Raw body parser for webhook signature verification
      this.app.use(express.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf.toString();
        }
      }));

      // Serve static website from website/out folder
      // Note: __dirname will be in dist/services after compilation, so we go up to find website/out
      const websitePath = path.join(__dirname, "..", "..", "website", "out");
      this.app.use(express.static(websitePath));

      // Redirect to bot invite link at /invite
      this.app.get("/invite", (req: Request, res: Response) => {
        if (this.discordClient?.user?.id) {
          const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${this.discordClient.user.id}&permissions=36700160&scope=bot%20applications.commands`;
          res.redirect(inviteUrl);
        } else {
          // Fallback if client not set - use hardcoded client ID
          const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=1315125264786653225&permissions=36700160&scope=bot%20applications.commands`;
          res.redirect(inviteUrl);
        }
      });

      // Health check endpoint
      this.app.get("/health", (req: Request, res: Response) => {
        res.json({ 
          status: "healthy",
          patreonConfigured: !!config.PATREON_CREATOR_ACCESS_TOKEN,
          webhookSecretConfigured: !!config.PATREON_WEBHOOK_SECRET
        });
      });

      // Patreon webhook endpoint
      this.app.post("/webhooks/patreon", async (req: Request, res: Response) => {
        console.log("[Webhook] Received Patreon webhook");
        
        const signature = req.headers["x-patreon-signature"] as string;
        const event = req.headers["x-patreon-event"] as string;
        const rawBody = (req as any).rawBody;

        // Log webhook details (for debugging)
        console.log(`[Webhook] Event: ${event}`);
        console.log(`[Webhook] Signature present: ${!!signature}`);

        // Verify signature if secret is configured
        if (config.PATREON_WEBHOOK_SECRET) {
          const patreonService = PatreonService.getInstance();
          
          if (!signature) {
            console.warn("[Webhook] Missing signature header");
            res.status(401).json({ error: "Missing signature" });
            return;
          }

          if (!patreonService.verifyWebhookSignature(rawBody, signature)) {
            console.warn("[Webhook] Invalid signature");
            res.status(401).json({ error: "Invalid signature" });
            return;
          }

          console.log("[Webhook] Signature verified ✓");
        } else {
          console.warn("[Webhook] No webhook secret configured, skipping signature verification");
        }

        // Process the webhook
        try {
          const patreonService = PatreonService.getInstance();
          const result = await patreonService.handleWebhook(event, req.body);
          console.log(`[Webhook] ${result.message}`);
          res.json(result);
        } catch (error) {
          console.error("[Webhook] Error processing webhook:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      });

      // Test endpoint to check webhook secret
      this.app.post("/webhooks/test", (req: Request, res: Response) => {
        const signature = req.headers["x-patreon-signature"] as string;
        const rawBody = (req as any).rawBody;
        
        if (config.PATREON_WEBHOOK_SECRET && signature) {
          const patreonService = PatreonService.getInstance();
          const isValid = patreonService.verifyWebhookSignature(rawBody, signature);
          res.json({ 
            signatureValid: isValid,
            message: isValid ? "Webhook signature is valid!" : "Webhook signature is INVALID"
          });
        } else {
          res.json({ 
            signatureValid: null,
            message: "No webhook secret configured or no signature provided"
          });
        }
      });

      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`[WebhookServer] 🌐 Server started on port ${this.port}`);
          console.log(`[WebhookServer] 📍 Local URL: http://localhost:${this.port}/webhooks/patreon`);
          console.log(`[WebhookServer] 🔗 Public URL: ${WEBHOOK_BASE_URL}/webhooks/patreon`);
          resolve({ success: true, message: `Webhook server started on port ${this.port}` });
        });

        this.server.on("error", (error: any) => {
          if (error.code === "EADDRINUSE") {
            this.server = null;
            resolve({ success: false, message: `Port ${this.port} is already in use` });
          } else {
            this.server = null;
            resolve({ success: false, message: `Server error: ${error.message}` });
          }
        });
      } catch (error: any) {
        resolve({ success: false, message: `Failed to start server: ${error.message}` });
      }
    });
  }

  /**
   * Stop the webhook server
   */
  public stop(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve({ success: false, message: "Server is not running" });
        return;
      }

      this.server.close((err: any) => {
        if (err) {
          resolve({ success: false, message: `Error stopping server: ${err.message}` });
        } else {
          this.server = null;
          this.app = null;
          console.log("[WebhookServer] Server stopped");
          resolve({ success: true, message: "Webhook server stopped" });
        }
      });
    });
  }

  /**
   * Get server status
   */
  public getStatus(): { running: boolean; port: number; webhookUrl: string; publicUrl: string } {
    return {
      running: this.isRunning(),
      port: this.port,
      webhookUrl: `http://localhost:${this.port}/webhooks/patreon`,
      publicUrl: `${WEBHOOK_BASE_URL}/webhooks/patreon`
    };
  }
}

// Export singleton getter
export function useWebhookServer(): WebhookServer {
  return WebhookServer.getInstance();
}
