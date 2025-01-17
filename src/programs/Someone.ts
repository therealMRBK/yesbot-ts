import { GuildMember, Message, TextChannel, User } from "discord.js";
import Tools from "../common/tools";
import axios from "axios";
import { isAfter, addHours } from "date-fns";

import { SomeoneRepository } from "../entities";

const QUESTION_LINK: string =
  "https://spreadsheets.google.com/feeds/cells/1eve4McRxECmH4dLWLJvHLr9fErBWcCGiH94ihBNzK_s/1/public/full?alt=json";

async function Someone(message: Message) {
  const allow = await isAllowed(message.author);

  if (!allow) {
    Tools.handleUserError(message, "You have already used this command today!");
    return;
  }

  const seekDiscormfortRole = Tools.getRoleByName(
    "Seek Discomfort",
    message.guild
  );
  const hasSeekDiscomfort = message.member.roles.cache.has(
    seekDiscormfortRole.id
  );

  if (!hasSeekDiscomfort) {
    Tools.handleUserError(
      message,
      "You need the Seek Discomfort role for that! You can get one by writing a detailed bio of yourself in <#616616321089798145>."
    );
    return;
  }

  const words = Tools.stringToWords(message.cleanContent);
  const arg = words[1];
  if (arg && arg !== "online")
    message.channel.send(`Unknown argument "${arg}". Did you mean "online"?`, {
      disableMentions: "all",
    });
  else {
    const { member } = message;
    const target = getTarget(arg, message);
    const question = await getQuestion();
    if (target === undefined)
      message.reply(
        "There were no available users to ping! This is embarrassing. How could this have happened? There's so many people on here that statistically this message should never even show up. Oh well. Congratulations, I guess."
      );
    else {
      updateLastMessage(message);
      sendMessage(member, target, question, message.channel as TextChannel);
    }
  }

  message.delete();
}

const sendMessage = async (
  author: GuildMember,
  target: User,
  question: string,
  channel: TextChannel
) => {
  const webhook = await channel.createWebhook(author.displayName, {
    avatar: author.user.avatarURL(),
  });
  await webhook.send(`<@${target.id}> ${question}`);
  await webhook.delete();
};

async function updateLastMessage(message: Message) {
  const someones = await SomeoneRepository();
  const someone = someones.create({
    id: message.author.id,
  });

  try {
    someones.save({
      ...someone,
      time: new Date(),
    });
  } catch (e) {
    console.error(`Failed to save @someone for user '${someone.id}'`);
    return false;
  }

  return true;
}

async function isAllowed(user: User) {
  const someoneRepository = await SomeoneRepository();
  const someone = await someoneRepository.findOne({ id: user.id });

  if (someone === undefined) {
    return true;
  }

  return isAfter(new Date(), addHours(someone.time, 24));
}

function getTarget(arg: string, message: Message): User {
  if (!message) return;

  const sdRole = Tools.getRoleByName("Seek Discomfort", message.guild);
  if (!sdRole) {
    message.channel.send("There is no Seek Discomfort role in this server!");
    return;
  }

  const targetCollection =
    arg && arg === "online"
      ? sdRole.members.filter(
          (member) => member.user.presence.status === "online"
        )
      : sdRole.members;

  if (
    targetCollection.size === 0 ||
    (targetCollection.size === 1 &&
      targetCollection.first().user.id === message.author.id)
  )
    return;

  let randomUser;
  do {
    randomUser = targetCollection.random().user;
  } while (randomUser.id === message.author.id);

  return randomUser;
}

async function getQuestion() {
  let entries: string[] = [];
  const response = await axios.get(QUESTION_LINK);
  response.data.feed.entry.forEach((element: any) => {
    entries.push(element.content.$t);
  });
  const question = entries[Math.floor(Math.random() * entries.length)];
  return question;
}

export default Someone;
