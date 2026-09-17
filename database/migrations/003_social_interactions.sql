CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    viewer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    viewed_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    viewed_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT profile_views_not_self
        CHECK (viewer_id <> viewed_id)
);

CREATE INDEX IF NOT EXISTS profile_views_viewer_index
    ON profile_views(viewer_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS profile_views_viewed_index
    ON profile_views(viewed_id, viewed_at DESC);


CREATE TABLE IF NOT EXISTS likes (
    liker_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    liked_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (liker_id, liked_id),

    CONSTRAINT likes_not_self
        CHECK (liker_id <> liked_id)
);

CREATE INDEX IF NOT EXISTS likes_received_index
    ON likes(liked_id, created_at DESC);


CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    blocked_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (blocker_id, blocked_id),

    CONSTRAINT blocks_not_self
        CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_received_index
    ON blocks(blocked_id);


CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    reported_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT reports_not_self
        CHECK (reporter_id <> reported_id),

    CONSTRAINT reports_reason_not_empty
        CHECK (length(trim(reason)) > 0),

    CONSTRAINT one_report_per_user
        UNIQUE (reporter_id, reported_id)
);

CREATE INDEX IF NOT EXISTS reports_reported_index
    ON reports(reported_id, created_at DESC);
