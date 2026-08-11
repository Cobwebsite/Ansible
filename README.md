# Provisionnement d'un VPS Debian 13

Ces playbooks installent Docker, ajoutent l'utilisateur `debian` au groupe
`docker`, configurent l'authentification SSH par mot de passe, puis déploient
Caddy, Portainer et Semaphore UI sous `/opt/docker`. Seul Caddy publie des ports
sur l'hôte. Portainer et Semaphore communiquent avec lui par le réseau Docker
externe `proxy`.

## Utilisation avec Semaphore UI

Le DNS des domaines doit pointer vers le VPS, et les ports TCP 80/443 ainsi que
UDP 443 doivent être autorisés chez Infomaniak.

Dans Semaphore, créer un projet lié à ce dépôt, puis configurer directement dans
l'interface :

- l'inventaire et l'adresse du VPS ;
- le dépôt Git ;
- la clé SSH ou les identifiants de connexion ;
- l'élévation de privilèges (`become`) ;
- les variables nécessaires à chaque template de tâche.

La collection `community.docker` déclarée dans `requirements.yml` doit être
installée dans l'environnement qui exécute Ansible. Les rôles du dépôt sont
trouvés grâce au `roles_path = roles` conservé dans `ansible.cfg`.

### Serveur master

Créer les templates de tâche Semaphore dans cet ordre :

1. `playbooks/installation/01-install-docker.yml`
2. `playbooks/installation/02-configure-ssh.yml`
3. `playbooks/installation/03-install-caddy.yml`
4. `playbooks/installation/04-install-portainer.yml`, avec `domain`
5. `playbooks/installation/05-install-semaphore.yml`, avec `domain`

Pour provisionner un nouveau VPS en une seule tâche, utiliser plutôt
`playbooks/installation/00-install-all.yml` avec les variables suivantes :

```yaml
portainer_domain: portainer.example.com
semaphore_domain: semaphore.example.com
authentik_domain: auth.example.com
termix_domain: termix.example.com
uptime_kuma_domain: status.example.com
beszel_domain: monitoring.example.com
homepage_domain: home.example.com
```

Le master installe également Authentik, Termix avec `guacd`, Uptime Kuma 2 et le
hub Beszel ainsi que Homepage. Toutes les stacks sont placées sous `/opt/docker`
et seul Caddy publie des ports sur l'hôte.

Authentik utilise la version `2026.5.6` épinglée par le Compose officiel, sans
Redis. Le tag flottant `latest` n'est volontairement pas utilisé afin d'éviter
qu'une version incompatible soit conservée ou téléchargée.

À la première installation, le résultat Semaphore affiche le mot de passe de
`akadmin`. Il reste stocké pour root dans `/opt/docker/authentik/.env`.

### Activer Authentik pour Portainer, Semaphore et Homepage

Les routes Caddy de Portainer, Semaphore et Homepage utilisent le snippet
`authentik`. Dans Authentik, créer pour chacun :

1. un Proxy Provider en mode forward auth avec l'URL externe complète ;
2. une Application associée à ce provider ;
3. l'association du provider à l'Embedded Outpost.

Utiliser respectivement `https://portainer.example.com`,
`https://semaphore.example.com` et `https://home.example.com` comme external
host. L'URL
`/outpost.goauthentik.io/*` reste accessible sans authentification, comme requis
par Authentik. En cas de problème, tester par exemple :

```bash
curl -I https://portainer.example.com/outpost.goauthentik.io/ping
```

Le hub Beszel est installé sans agent. Après la création du compte administrateur,
ajouter les agents depuis son interface afin d'obtenir leur `KEY` et leur `TOKEN`.

Homepage est protégé par Authentik dans le setup master. Sa configuration se
trouve dans `/opt/docker/homepage/config` et contient les liens vers les services
du master. L'accès en lecture à Docker passe par un socket proxy avec les requêtes
`POST` désactivées. Le composant seul peut être installé avec
`playbooks/installation/12-install-homepage.yml` et la variable `domain`; dans ce
cas, la protection Authentik est désactivée sauf si
`homepage_authentik_enabled: true` est fourni.

### Serveur slave

Pour installer Docker, configurer SSH, déployer Caddy et Portainer Agent en une
seule tâche, utiliser `playbooks/installation/10-install-slave.yml` :

```yaml
portainer_agent_domain: agent.example.com
```

Le port `9001` de l'Agent n'est pas publié sur l'hôte. Caddy est le seul point
d'entrée public. Dans Portainer master, ajouter ensuite un environnement Docker
Standalone de type Agent avec l'adresse `agent.example.com:443` et TLS activé.
Sans secret partagé, effectuer cette association dans les cinq minutes suivant
le premier démarrage de l'Agent. Si le master utilise `AGENT_SECRET`, fournir la
même valeur au template slave dans la variable secrète
`portainer_agent_secret`.

Le composant seul peut être installé avec
`playbooks/installation/06-install-portainer-agent.yml` et la variable `domain`.

Les playbooks ciblent par défaut tous les hôtes de l'inventaire. Pour employer
un groupe ou un hôte précis, définir `target` dans les variables du template
Semaphore. À la première installation de Semaphore, le résultat de la tâche
affiche le mot de passe administrateur généré. Les secrets persistants restent
dans `/opt/docker/semaphore/.env` avec des droits restreints.

Le mot de passe de l'utilisateur `debian` est également généré et affiché lors
de la première exécution. Il reste disponible uniquement pour root dans
`/root/.ansible-generated-credentials/debian-password`. Les exécutions suivantes
le conservent. Pour forcer sa rotation, exécuter le playbook SSH ou le master avec
`regenerate_debian_password: true`; le nouveau mot de passe sera alors affiché.

## Maintenance

Le template `playbooks/maintenance/general/disk-space.yaml` contrôle par défaut
la partition `/` avec un seuil de 85 %. Il envoie une seule alerte Telegram lors
du dépassement, puis une notification de retour à la normale. Configurer dans
Semaphore :

```yaml
telegram_bot_token: "valeur secrète"
telegram_chat_id: "123456789"
disk_usage_threshold: 85
```

Les restaurations Rayuki exigent volontairement `confirm_restore: true`. Les
mots de passe FTP et de base de données doivent être enregistrés comme variables
secrètes dans Semaphore.
