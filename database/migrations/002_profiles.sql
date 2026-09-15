CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    gender VARCHAR(30),
    sexual_preference VARCHAR(30) NOT NULL DEFAULT 'bisexual',
    biography VARCHAR(1000),
    birth_date DATE,

    fame_rating INTEGER NOT NULL DEFAULT 0,

    location_consent BOOLEAN NOT NULL DEFAULT FALSE,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    city VARCHAR(150),
    neighborhood VARCHAR(150),

    last_online_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT profiles_gender_check
        CHECK (
            gender IS NULL
            OR gender IN ('male', 'female', 'non_binary', 'other')
        ),

    CONSTRAINT profiles_preference_check
        CHECK (
            sexual_preference IN (
                'male',
                'female',
                'bisexual'
            )
        ),

    CONSTRAINT profiles_birth_date_check
        CHECK (
            birth_date IS NULL
            OR birth_date <= CURRENT_DATE - INTERVAL '18 years'
        ),

    CONSTRAINT profiles_fame_rating_check
        CHECK (fame_rating BETWEEN 0 AND 100),

    CONSTRAINT profiles_latitude_check
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT profiles_longitude_check
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        ),

    CONSTRAINT profiles_location_check
    CHECK (
        location_consent = FALSE
        OR (
            latitude IS NOT NULL
            AND longitude IS NOT NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tags_name_not_empty
        CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique
    ON tags(lower(name));

CREATE TABLE IF NOT EXISTS user_tags (
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    tag_id UUID NOT NULL
        REFERENCES tags(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS profile_pictures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    file_path TEXT NOT NULL,
    is_profile_picture BOOLEAN NOT NULL DEFAULT FALSE,
    position SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT profile_pictures_position_check
        CHECK (position BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_profile_picture_per_user
    ON profile_pictures(user_id)
    WHERE is_profile_picture = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS one_picture_position_per_user
    ON profile_pictures(user_id, position);

CREATE INDEX IF NOT EXISTS profiles_location_index
    ON profiles(latitude, longitude);

CREATE INDEX IF NOT EXISTS profiles_fame_rating_index
    ON profiles(fame_rating);

CREATE INDEX IF NOT EXISTS user_tags_tag_id_index
    ON user_tags(tag_id);