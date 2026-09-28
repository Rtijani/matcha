CREATE TABLE IF NOT EXISTS picture_likes (
    picture_id UUID NOT NULL
        REFERENCES profile_pictures(id) ON DELETE CASCADE,
    liker_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (picture_id, liker_id)
);

CREATE INDEX IF NOT EXISTS picture_likes_liker_index
    ON picture_likes(liker_id);

ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (
        type IN (
            'profile_view',
            'like',
            'match',
            'message',
            'unlike',
            'picture_like',
            'picture_unlike'
        )
    );
