# --- BUILD --- #
# Utilise l'image officielle de Deno
FROM denoland/deno:2.4.2 as builder

WORKDIR /app

# Copier le code source du projet
COPY . .

# Mettre en cache les dépendances
RUN deno cache --node-modules-dir api/main.ts

# Si on veut repartir de zéro, on peut supprimer la base de données locale
# RUN rm -f baseball.db

# Générer les migrations (au cas où le schéma aurait changé)
RUN deno task drizzle:generate


# --- PRODUCTION --- #
FROM denoland/deno:2.4.2

WORKDIR /app

# Copier les dépendances et le code depuis le build
COPY --from=builder /app/deno.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api ./api
COPY --from=builder /app/drizzle.config.ts .
COPY --from=builder /app/api/db/migrations ./api/db/migrations

# Spécifier les permissions nécessaires pour l'exécution
# --allow-net -> serveur web et pour télécharger la lib sqlite
# --allow-read/write -> BDD & migrations
# --allow-ffi/env -> driver sqlite
ARG DENO_PERMISSIONS="--allow-net --allow-read --allow-write --allow-env --allow-ffi --unstable-ffi"

# Port d'exposition (classique)
EXPOSE 8000

# Créer le dossier pour la base de données et donner les permissions
RUN mkdir /app/data && chown -R deno:deno /app/data

# Donner la propriété des fichiers à l'utilisateur deno
RUN chown -R deno:deno /app

# Utilisation utilisateur non-root `deno` pour la sécurité fournit par Deno
USER deno

# On lance l'app
CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-ffi", "--unstable-ffi", "api/main.ts"]
