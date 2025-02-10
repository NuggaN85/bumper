**`Mise à jour : version 1.1.3`**

### **Fonctionnalités du Bot Bump**

### **1. Commandes Principales**
- **`/bump`** : Promouvoir votre serveur dans tous les salons configurés.  
  - Cooldown : 1 heure.  
  - Gain d'XP et progression de niveau.  
  - Badges de serveur (Débutant, Promoteur, Expert, etc.).  

- **`/vote`** : Voter pour votre serveur.  
  - Cooldown : 24 heures.  
  - Augmente la visibilité du serveur.  

- **`/top_server`** : Affiche le top 10 des serveurs les plus bumpés.  
- **`/top_user`** : Affiche le top 10 des utilisateurs les plus actifs.  

### **2. Configuration (Admin uniquement)**
- **`/bump_config`** : Configurer la description et la bannière du bump.  
- **`/bump_set_channel`** : Définir le salon où les bumps seront envoyés.  
- **`/bump_toggle`** : Activer/désactiver le bot sur le serveur.  
- **`/ping_config`** : Activer/désactiver les rappels de bump.  

### **3. Statistiques et Prévisualisation**
- **`/stats_bump`** : Affiche des statistiques détaillées (bumps, votes, vues, etc.).  
- **`/bump_preview`** : Aperçu du bump avant envoi.  

### **4. Fonctionnalités Automatiques**
- **Réinitialisation des compteurs** :  
  - Quotidienne, hebdomadaire et mensuelle.  
- **Création d'invitations** : Une invitation est automatiquement créée pour chaque serveur.  
- **Attribution de rôles** : Rôles basés sur le niveau d'XP des utilisateurs.  

### **5. Sécurité et Limites**
- **Rate Limiting** : Limite de 5 commandes par utilisateur par minute.  
- **Permissions** : Les commandes de configuration sont réservées aux administrateurs.  

### **Comment Utiliser le Bot ?**
1. Créé une applications sur le portail dev discord.
2. Modifier le fichier **`.env`** pour mettre le Token et l'ID du bot.
3. Invitez le bot sur votre serveur.  
4. Configurez le salon de bump avec **`/bump_set_channel`**.  
5. Personnalisez votre bump avec **`/bump_config`**.  
6. Utilisez **`/bump`** pour promouvoir votre serveur.
