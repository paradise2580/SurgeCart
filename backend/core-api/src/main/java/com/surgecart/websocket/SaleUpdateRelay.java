package com.surgecart.websocket;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** The other half of the multi-instance fix — see SaleBroadcastService. */
@Component
@RequiredArgsConstructor
public class SaleUpdateRelay {

    private final RedisMessageListenerContainer listenerContainer;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @PostConstruct
    public void subscribe() {
        listenerContainer.addMessageListener(relayListener(), new ChannelTopic(SaleBroadcastService.CHANNEL));
    }

    private MessageListener relayListener() {
        return (Message message, byte[] pattern) -> {
            try {
                String json = new String(message.getBody());
                JsonNode node = objectMapper.readTree(json);
                Long saleId = node.get("saleId").asLong();
                messagingTemplate.convertAndSend("/topic/sale/" + saleId, json);
            } catch (Exception ignored) {
                // A malformed relay message must never take the broadcast
                // channel down for every other sale.
            }
        };
    }
}
