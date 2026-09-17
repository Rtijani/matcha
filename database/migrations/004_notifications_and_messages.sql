CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    content VARCHAR(2000) NOT NULL,

    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT messages_not_self
        CHECK (sender_id <> receiver_id),

    CONSTRAINT messages_content_not_empty
        CHECK (length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS messages_conversation_index
    ON messages(
        sender_id,
        receiver_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS messages_receiver_unread_index
    ON messages(receiver_id, created_at DESC)
    WHERE read_at IS NULL;


CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(id) ON DELETE CASCADE,

    type VARCHAR(30) NOT NULL,
    message VARCHAR(500) NOT NULL,

    related_id UUID,

    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notifications_not_self
        CHECK (
            actor_id IS NULL
            OR recipient_id <> actor_id
        ),

    CONSTRAINT notifications_type_check
        CHECK (
            type IN (
                'profile_view',
                'like',
                'match',
                'message',
                'unlike'
            )
        ),

    CONSTRAINT notifications_message_not_empty
        CHECK (length(trim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_index
    ON notifications(
        recipient_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS notifications_unread_index
    ON notifications(
        recipient_id,
        created_at DESC
    )
    WHERE read_at IS NULL;
