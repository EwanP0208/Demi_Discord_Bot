const Discord = require('discord.js');
const snoowrap = require('snoowrap');
const ytdl = require('ytdl-core');
const client = new Discord.Client();

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

//Using dotenv .env file to store connection details
require('dotenv').config();
const bot_config = require('./config/bot_config.json');

const token = process.env.DISCORD_TOKEN;
const channel_reddit = bot_config.Channels.redditChannelID;
const channel_rightmove = bot_config.Channels.rightmoveChannelID;
const rightmove_url = bot_config.Rightmove.searchURL;

const reddit = new snoowrap({
    userAgent: "demi-discord-bot",
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});


var today = new Date();
var last_run_day = 0;

function post_message(text, channel) {
    const text_channel = client.channels.cache.get(channel);
    text_channel.send(text);
}


async function get_top_posts(subreddit, num_results) {
    const sub_reddit = await reddit.getSubreddit(subreddit);
    const topPosts = await sub_reddit.getTop({time: 'day', limit: num_results});

    let top_posts = [];
    topPosts.forEach((post) => {
        top_posts.push({
            url: post.url,
            title: post.title
        })
    });

    return top_posts;
}

function reddit_top() {
    let day_string = today.getDate() + "/" + (today.getMonth()+1) + '/' + today.getFullYear();
    post_message("**Top 5 Posts in the last 24 Hours - " + day_string + "**", channel_reddit);

    top_posts = get_top_posts("worldnews", 5);
    top_posts.then(posts => {
        for (var i = 0; i < posts.length; i++) {
            post_message(i+1 + ": " + posts[i].title + "\n" + posts[i].url, channel_reddit);
        }
    });
}


const fetchRightmove = async () => {
    const result = await axios.get(rightmove_url);
    return cheerio.load(result.data);
};

async function get_rightmove_listings(){
    const $ = await fetchRightmove();
    let property_listings = [];

    for (var i = 1; i < 25; i++){
        search_term = 'div[data-test="propertyCard-' + i + '"]'
        property_link = $(search_term).find($('.propertyCard-link')).attr('href');
        property_listings.push(property_link);
    }

    return property_listings;
};

async function get_newest_rightmove_listings(){
    let property_listings = await get_rightmove_listings();

    let most_recent_listing = fs.readFileSync('most-recent-property', 'utf-8');

    let new_properties = [];
    let recent_index = property_listings.indexOf(most_recent_listing);

    if (recent_index === -1) {
        //if it's -1, then the link is not in the 24 newest items, so return the full list as the newest items
        new_properties = property_listings;
    } else if (recent_index > 0) {
        //if it's more than 0, then there is at least 1 new property, so return a sliced array
        new_properties = property_listings.slice(0, recent_index);
    } //if it's 0 then the array stays empty

    fs.writeFileSync('most-recent-property', property_listings[0]);

    return new_properties;
}

async function post_newest_rightmove_listings(){
    let properties = await get_newest_rightmove_listings();

    if (properties.length > 0) {
        console.log("new properties");
        post_message("**New Properties for Sale**", channel_rightmove);

        properties.forEach(property => {
            post_message("https://www.rightmove.co.uk" + property, channel_rightmove);
        });
    }
}

client.on('ready', () => {
    console.log('Bot is Online');

    //Every hour after the bot is booted, check right move for any new listings
    post_newest_rightmove_listings();
    setInterval(() => {
        post_newest_rightmove_listings();
    }, 360000);
});

client.on('message', message => {
    if (message.content === "!reddit"){
        reddit_top();
    }
});

client.login(token);