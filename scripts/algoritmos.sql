-- 1. Algoritmo para el Feed (For You)
-- Se basa en el Hacker News Ranking Algorithm modificado (Puntaje disminuye con el tiempo)
CREATE OR REPLACE FUNCTION get_recommended_posts(p_user_id UUID, p_limit INT DEFAULT 10, p_offset INT DEFAULT 0)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    image_url TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ,
    score FLOAT,
    profiles JSON,
    likes JSON,
    comments JSON
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        -- Score: (likes * 2 + comments * 3) / (horas_desde_posteo + 2)^1.5
        -- Evita dividir por cero y empuja posts nuevos o muy comentados arriba.
        (
            ((SELECT count(*) FROM likes WHERE post_id = p.id) * 2.0 + 
             (SELECT count(*) FROM comments WHERE post_id = p.id) * 3.0) /
            POWER(EXTRACT(EPOCH FROM (now() - p.created_at))/3600.0 + 2.0, 1.5)
        )::FLOAT AS score,
        json_build_object(
            'name', pr.name,
            'avatar_url', pr.avatar_url
        ) as profiles,
        (SELECT COALESCE(json_agg(json_build_object('user_id', l.user_id)), '[]'::json) FROM likes l WHERE l.post_id = p.id) as likes,
        (SELECT COALESCE(json_agg(json_build_object('id', c.id)), '[]'::json) FROM comments c WHERE c.post_id = p.id) as comments
    FROM posts p
    JOIN profiles pr ON p.user_id = pr.id
    ORDER BY score DESC, p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 2. Algoritmo de Sugerencia de Amigos (Suggested Friends)
-- Analiza los "Amigos en común" y hace fallback a los perfiles más seguidos de la red.
CREATE OR REPLACE FUNCTION get_suggested_friends(p_user_id UUID, p_limit INT DEFAULT 6)
RETURNS TABLE (
    id UUID,
    name TEXT,
    avatar_url TEXT,
    bio TEXT,
    score INT,
    follows JSON -- Array vacío devolviendo el formato FrontEnd
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH user_follows AS (
        -- Cuentas que ya sigo (para ignorarlas)
        SELECT following_id FROM follows WHERE follower_id = p_user_id
    ),
    mutual_friends AS (
        -- Personas que son seguidas por la gente que yo sigo (Amigos en común)
        SELECT f.following_id as profile_id, count(*) as mutual_count
        FROM follows f
        WHERE f.follower_id IN (SELECT following_id FROM user_follows)
          AND f.following_id != p_user_id
          AND f.following_id NOT IN (SELECT following_id FROM user_follows)
        GROUP BY f.following_id
    ),
    popular_users AS (
        -- Si no hay mutuals, traemos a los influencers de la app
        SELECT pr.id as profile_id, (SELECT count(*) FROM follows WHERE following_id = pr.id) as pop_count
        FROM profiles pr
        WHERE pr.id != p_user_id
          AND pr.id NOT IN (SELECT following_id FROM user_follows)
    ),
    combined_scores AS (
        -- Fusionamos ambos puntajes (Mutuals pesan más que Popularidad)
        SELECT 
            p.id,
            COALESCE(m.mutual_count, 0) * 10 + COALESCE(pu.pop_count, 0) as final_score
        FROM profiles p
        LEFT JOIN mutual_friends m ON p.id = m.profile_id
        LEFT JOIN popular_users pu ON p.id = pu.profile_id
        WHERE p.id != p_user_id
          AND p.id NOT IN (SELECT following_id FROM user_follows)
    )
    SELECT 
        pr.id,
        pr.name,
        pr.avatar_url,
        pr.bio,
        cs.final_score::INT as score,
        '[]'::json as follows
    FROM profiles pr
    JOIN combined_scores cs ON pr.id = cs.id
    ORDER BY cs.final_score DESC, pr.id
    LIMIT p_limit;
END;
$$;