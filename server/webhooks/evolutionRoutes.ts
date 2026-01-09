import type { Express, Request, Response } from "express";
import { whatsappService } from "../services/whatsappService";
import { db } from "../db";
import { 
  whatsappAlertConfigs,
  whatsappMessageLogs,
  users
} from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerEvolutionWebhooks(app: Express) {
  
  app.post("/api/webhooks/evolution/messages", async (req: Request, res: Response) => {
    try {
      const webhookData = req.body;
      console.log("[Evolution Webhook] Mensagem recebida:", JSON.stringify(webhookData).substring(0, 200));

      if (webhookData.event === "messages.upsert") {
        const messageData = webhookData.data;
        const remoteJid = messageData?.key?.remoteJid || "";
        const fromMe = messageData?.key?.fromMe || false;
        
        if (!fromMe && remoteJid.endsWith("@s.whatsapp.net")) {
          const phone = remoteJid.replace("@s.whatsapp.net", "");
          const messageText = messageData?.message?.conversation || 
                              messageData?.message?.extendedTextMessage?.text || "";
          
          try {
            await db.insert(whatsappMessageLogs).values({
              phone,
              direction: "incoming",
              messageType: "text",
              content: messageText.substring(0, 1000),
              status: "received",
              evolutionMessageId: messageData?.key?.id || null,
              createdAt: new Date(),
            });
          } catch (logError) {
            console.error("[Evolution Webhook] Erro ao salvar log:", logError);
          }

          const { response, action } = await whatsappService.processIncomingMessage(webhookData);
          
          if (response) {
            await whatsappService.sendTextMessage(phone, response);
            
            try {
              await db.insert(whatsappMessageLogs).values({
                phone,
                direction: "outgoing",
                messageType: "text",
                content: response.substring(0, 1000),
                status: "sent",
                createdAt: new Date(),
              });
            } catch (logError) {
              console.error("[Evolution Webhook] Erro ao salvar log de resposta:", logError);
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Evolution Webhook] Erro:", error);
      res.json({ success: false, error: "Erro ao processar webhook" });
    }
  });

  app.post("/api/webhooks/evolution/status", async (req: Request, res: Response) => {
    try {
      const statusData = req.body;
      console.log("[Evolution Webhook] Status update:", statusData.event);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Evolution Webhook] Status error:", error);
      res.json({ success: false });
    }
  });

  app.get("/api/whatsapp/status", async (req: Request, res: Response) => {
    try {
      const status = await whatsappService.checkInstanceStatus();
      res.json(status);
    } catch (error) {
      console.error("[WhatsApp Status] Erro:", error);
      res.json({ connected: false, error: "Erro ao verificar status" });
    }
  });

  app.post("/api/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { phone, message, type = "text" } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ error: "Phone e message são obrigatórios" });
      }

      const result = await whatsappService.sendTextMessage(phone, message);
      
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      try {
        await db.insert(whatsappMessageLogs).values({
          phone,
          direction: "outgoing",
          messageType: type,
          content: message.substring(0, 1000),
          status: "sent",
          createdAt: new Date(),
        });
      } catch (logError) {
        console.error("[WhatsApp Send] Erro ao salvar log:", logError);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[WhatsApp Send] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  });

  app.post("/api/whatsapp/send-license-alert", async (req: Request, res: Response) => {
    try {
      const { phone, licenseName, enterpriseName, expirationDate, daysRemaining } = req.body;
      
      if (!phone || !licenseName || !enterpriseName || !expirationDate || daysRemaining === undefined) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: phone, licenseName, enterpriseName, expirationDate, daysRemaining" 
        });
      }

      const result = await whatsappService.sendLicenseExpirationAlert(
        phone, licenseName, enterpriseName, expirationDate, daysRemaining
      );
      
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[WhatsApp License Alert] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar alerta" });
    }
  });

  app.post("/api/whatsapp/send-condicionante-alert", async (req: Request, res: Response) => {
    try {
      const { phone, conditionanteName, licenseName, dueDate, daysRemaining } = req.body;
      
      if (!phone || !conditionanteName || !licenseName || !dueDate || daysRemaining === undefined) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: phone, conditionanteName, licenseName, dueDate, daysRemaining" 
        });
      }

      const result = await whatsappService.sendConditionanteAlert(
        phone, conditionanteName, licenseName, dueDate, daysRemaining
      );
      
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[WhatsApp Condicionante Alert] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar alerta" });
    }
  });

  app.post("/api/whatsapp/send-task-alert", async (req: Request, res: Response) => {
    try {
      const { phone, taskTitle, assignerName, dueDate, priority } = req.body;
      
      if (!phone || !taskTitle || !assignerName || !dueDate) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: phone, taskTitle, assignerName, dueDate" 
        });
      }

      const result = await whatsappService.sendTaskAssignmentAlert(
        phone, taskTitle, assignerName, dueDate, priority || "media"
      );
      
      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("[WhatsApp Task Alert] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar alerta" });
    }
  });

  app.get("/api/whatsapp/message-logs", async (req: Request, res: Response) => {
    try {
      const { phone, limit = 50 } = req.query;
      
      let logs;
      if (phone) {
        logs = await db.select()
          .from(whatsappMessageLogs)
          .where(eq(whatsappMessageLogs.phone, phone as string))
          .orderBy(whatsappMessageLogs.createdAt)
          .limit(parseInt(limit as string));
      } else {
        logs = await db.select()
          .from(whatsappMessageLogs)
          .orderBy(whatsappMessageLogs.createdAt)
          .limit(parseInt(limit as string));
      }
      
      res.json(logs);
    } catch (error) {
      console.error("[WhatsApp Logs] Erro:", error);
      res.status(500).json({ error: "Erro ao buscar logs" });
    }
  });

  console.log("[Evolution Webhooks] Rotas registradas com sucesso");
}
