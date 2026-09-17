import type { ReviewPost } from './monthly-review';

type Topic = 'project'|'people'|'event'|'practical'|'story';
function cleanCaption(value:string) {
  return value.replace(/@\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[\u115f\u1160\u3164]/g,'').replace(/\s+/g,' ').trim();
}
/** Creative proposals, explicitly grounded in a referenced post; never invented results. */
export function editorialProposal(post:ReviewPost) {
  const caption=cleanCaption(post.caption);
  const text=caption.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const topic:Topic=/foire|salon|rendez-vous|evenement|inscription/.test(text)?'event':/collaborateur|portrait|recrut|formation|parcours|competence|notre equipe|nos metiers/.test(text)?'people':/chantier|batiment|construction|realisation|projet|exploitant|stockage/.test(text)?'project':/conseil|erreur|etape|astuce|comment |guide/.test(text)?'practical':'story';
  const reference=caption.split(/(?<=[.!?])\s/)[0].slice(0,95)||'votre publication de référence';
  const angles:Record<Topic,string>={
    project:'Partir du besoin du client, montrer la difficulté puis la solution apportée.',
    people:'Faire raconter une situation de travail précise par la personne concernée.',
    event:'Prolonger l’événement avec une question réellement posée sur place et sa réponse.',
    practical:'Transformer le sujet en démonstration que le lecteur peut appliquer.',
    story:'Approfondir un seul fait de cette publication avec une preuve visuelle et son explication.'
  };
  const shots:Record<Topic,string[]>={
    project:['Ouvrir avec le résultat final et nommer le besoin auquel il répond.','Montrer une contrainte du projet, puis le détail qui explique la solution retenue.','Faire expliquer le bénéfice par le client ou le responsable du projet ; utiliser uniquement un résultat confirmé.'],
    people:['Présenter la personne et une mission concrète, en une phrase.','La filmer ou la photographier pendant cette mission, avec un détail de son geste ou de sa méthode.','Lui demander : « Qu’est-ce qui vous aide le plus à bien faire ce travail ? » Utiliser sa vraie réponse.'],
    event:['Choisir une question effectivement posée pendant l’événement.','Montrer un échange ou une démonstration liés à cette question, avec l’accord des personnes visibles.','Donner une réponse complète dans le contenu et indiquer où poursuivre l’échange.'],
    practical:['Annoncer le problème précis que le contenu aide à résoudre.','Montrer trois étapes, chacune avec une image ou une démonstration différente.','Terminer par une erreur à éviter, vérifiée avec la personne experte du sujet.'],
    story:['Choisir un seul fait déjà présent dans la publication de référence.','Retrouver une image, un objet ou un document qui permet de l’illustrer.','Expliquer ce que ce fait change pour le client ou l’activité aujourd’hui, avec une personne de l’équipe.']
  };
  const network={
    instagram:{format:'Un Reel vertical de 30 à 45 secondes',title:'Préparer un Reel qui montre plutôt qu’il ne raconte',steps:[`Premier plan : ${shots[topic][0]}`,...shots[topic].slice(1),'Ajouter des sous-titres et une couverture qui annonce le sujet. Terminer par une question précise liée à ce cas.']},
    facebook:{format:'Une publication de 3 photos légendées',title:'Raconter ce cas en trois photos sur Facebook',steps:[...shots[topic],'Écrire une légende courte : contexte, solution, résultat confirmé. Nommer le lieu ou le partenaire uniquement s’ils sont connus et peuvent être cités.','Terminer par une question à laquelle votre communauté peut répondre avec sa propre expérience.']},
    linkedin:{format:'Un carrousel LinkedIn de 5 pages',title:'Transformer ce sujet en cas concret sur LinkedIn',steps:[`Page 1 : ${shots[topic][0]}`,`Pages 2 et 3 : ${shots[topic][1]} Ajouter une photo ou un schéma pour expliquer.`,`Page 4 : ${shots[topic][2]}`,'Page 5 : retenir un enseignement utile à un professionnel. Dans la légende, demander : « Comment abordez-vous ce sujet dans votre équipe ? »']},
    tiktok:{format:'Une vidéo verticale de 20 à 30 secondes',title:'Montrer une démonstration courte sur TikTok',steps:['Commencer directement par le résultat ou le problème, sans introduction de marque.',...shots[topic],'Garder une seule idée, une personne ou une voix qui l’explique et des sous-titres lisibles.']},
    youtube:{format:'Une vidéo explicative de 2 à 4 minutes',title:'Développer ce sujet en démonstration sur YouTube',steps:['Présenter dans les premières secondes la question à laquelle la vidéo répond.',...shots[topic],'Organiser la description en chapitres et choisir une miniature montrant le résultat réellement visible dans la vidéo.']},
    twitter:{format:'Un fil de 3 publications avec une image',title:'Partager les faits essentiels dans un fil',steps:[...shots[topic],'Garder un fait par publication et renvoyer vers le contenu original pour les détails.']}
  }[post.platform];
  return {reference,angle:angles[topic],format:network.format,title:network.title,steps:network.steps};
}
