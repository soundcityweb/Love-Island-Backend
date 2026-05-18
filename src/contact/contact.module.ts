import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from '../entities/contact-message.entity';
import { ContactMessageReply } from '../entities/contact-message-reply.entity';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { AdminContactController } from './admin-contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, ContactMessageReply])],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
