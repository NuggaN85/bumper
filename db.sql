-- Table des serveurs
CREATE TABLE servers (
    guild_id VARCHAR(255) PRIMARY KEY, -- ID du serveur Discord
    enabled BOOLEAN DEFAULT TRUE,      -- Si le bot est activé sur ce serveur
    bump_channel VARCHAR(255),         -- ID du canal de bump
    description TEXT,                   -- Description du serveur
    banner_link TEXT,                   -- Lien de la bannière
    reminders BOOLEAN DEFAULT FALSE,   -- Si les rappels sont activés
    invite_link TEXT,                  -- Lien d'invitation du serveur
    ad_views INT DEFAULT 0,            -- Nombre de vues publicitaires
    vote_count INT DEFAULT 0,           -- Nombre de votes
    last_vote BIGINT DEFAULT 0,        -- Timestamp du dernier vote
    bump_count INT DEFAULT 0,           -- Nombre total de bumps
    bump_count_today INT DEFAULT 0,     -- Nombre de bumps aujourd'hui
    bump_count_week INT DEFAULT 0,      -- Nombre de bumps cette semaine
    bump_count_month INT DEFAULT 0,     -- Nombre de bumps ce mois-ci
    INDEX (bump_channel),              -- Index sur bump_channel pour améliorer les performances des requêtes
    INDEX (invite_link)                -- Index sur invite_link pour améliorer les performances des requêtes
);

-- Table des utilisateurs
CREATE TABLE users (
    guild_id VARCHAR(255),             -- ID du serveur Discord
    user_id VARCHAR(255),              -- ID de l'utilisateur
    bump_count INT DEFAULT 0,          -- Nombre de bumps de l'utilisateur
    xp INT DEFAULT 0,                  -- XP de l'utilisateur
    vote_count INT DEFAULT 0,          -- Nombre de votes de l'utilisateur
    last_level INT DEFAULT 0,          -- Dernier niveau atteint
    PRIMARY KEY (guild_id, user_id),   -- Clé primaire composée
    FOREIGN KEY (guild_id) REFERENCES servers(guild_id) ON DELETE CASCADE
);

-- Table des bumps
CREATE TABLE bumps (
    bump_id INT AUTO_INCREMENT PRIMARY KEY, -- ID unique du bump
    guild_id VARCHAR(255),                   -- ID du serveur Discord
    user_id VARCHAR(255),                    -- ID de l'utilisateur qui a bumpé
    bump_timestamp BIGINT,                   -- Timestamp du bump
    bump_channel VARCHAR(255),               -- ID du canal où le bump a été effectué
    bump_message_id VARCHAR(255),            -- ID du message de bump (optionnel)
    FOREIGN KEY (guild_id) REFERENCES servers(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE,
    INDEX (bump_timestamp),                  -- Index sur bump_timestamp pour améliorer les performances des requêtes
    INDEX (bump_channel)                     -- Index sur bump_channel pour améliorer les performances des requêtes
);

-- Table des rappels (optionnelle)
CREATE TABLE reminders (
    guild_id VARCHAR(255),             -- ID du serveur Discord
    user_id VARCHAR(255),              -- ID de l'utilisateur
    timestamp BIGINT,                  -- Timestamp du rappel
    PRIMARY KEY (guild_id, user_id),   -- Clé primaire composée
    FOREIGN KEY (guild_id) REFERENCES servers(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
);

-- Table des rôles (optionnelle)
CREATE TABLE roles (
    guild_id VARCHAR(255),             -- ID du serveur Discord
    role_name VARCHAR(255),            -- Nom du rôle
    role_color VARCHAR(255),           -- Couleur du rôle
    level_required INT,                -- Niveau requis pour ce rôle
    PRIMARY KEY (guild_id, role_name), -- Clé primaire composée
    FOREIGN KEY (guild_id) REFERENCES servers(guild_id) ON DELETE CASCADE
);

-- Table des votes (optionnelle)
CREATE TABLE votes (
    guild_id VARCHAR(255),             -- ID du serveur Discord
    user_id VARCHAR(255),              -- ID de l'utilisateur
    vote_timestamp BIGINT,             -- Timestamp du vote
    PRIMARY KEY (guild_id, user_id, vote_timestamp), -- Clé primaire composée
    FOREIGN KEY (guild_id) REFERENCES servers(guild_id) ON DELETE CASCADE,
    FOREIGN KEY (guild_id, user_id) REFERENCES users(guild_id, user_id) ON DELETE CASCADE
);
