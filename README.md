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
```

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
