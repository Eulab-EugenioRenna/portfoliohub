import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { integrationsConfig } from '../config/integrations.config';

@Injectable()
export class RabbitMqService implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async publish(topic: string, event: Record<string, unknown>): Promise<void> {
    await this.publishBatch([{ topic, event }]);
  }

  async publishBatch(
    messages: Array<{ topic: string; event: Record<string, unknown> }>,
  ): Promise<void> {
    if (messages.length === 0) return;
    const channel = await this.getChannel();
    await channel.assertExchange('portfoliohub.events', 'topic', { durable: true });
    for (const message of messages) {
      channel.publish(
        'portfoliohub.events',
        message.topic,
        Buffer.from(JSON.stringify(message.event)),
        { persistent: true, contentType: 'application/json' },
      );
    }
    await channel.waitForConfirms();
  }

  async ping(): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertExchange('portfoliohub.events', 'topic', { durable: true });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    this.connection = await amqp.connect(this.config.rabbitMqUrl);
    this.connection.on('error', (error) => this.logger.error(error));
    this.connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
    this.channel = await this.connection.createConfirmChannel();
    return this.channel;
  }
}
