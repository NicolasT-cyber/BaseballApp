import { RouterContext } from "https://deno.land/x/oak@v17.1.5/mod.ts";
import { Player } from "../models/player.ts";
import { db } from "../db/database.ts";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";

export const getPlayerById = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const player = await db.query.players.findFirst({ where: eq(schema.players.id, id) });
    if (player) {
      ctx.response.body = {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        jerseyNumber: player.jerseyNumber,
        birthDate: new Date(player.birthDate),
        teamId: player.teamId,
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Player not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch player", error: error.message };
  }
};

export const createPlayer = async (ctx: RouterContext) => {
  try {
    const body = await ctx.request.body.json();
    const newPlayerId = crypto.randomUUID();
    const newPlayer: Player = {
      id: newPlayerId,
      firstName: body.firstName,
      lastName: body.lastName,
      jerseyNumber: body.jerseyNumber,
      birthDate: new Date(body.birthDate),
      teamId: body.teamId,
    };
    await db.insert(schema.players).values({
      id: newPlayer.id,
      firstName: newPlayer.firstName,
      lastName: newPlayer.lastName,
      jerseyNumber: newPlayer.jerseyNumber,
      birthDate: newPlayer.birthDate.toISOString().split('T')[0],
      teamId: newPlayer.teamId,
    });
    ctx.response.status = 201;
    ctx.response.body = newPlayer;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to create player", error: error.message };
  }
};

export const updatePlayer = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const body = await ctx.request.body.json();
    const updatedData = {
      firstName: body.firstName,
      lastName: body.lastName,
      jerseyNumber: body.jerseyNumber,
      birthDate: new Date(body.birthDate).toISOString().split('T')[0],
      teamId: body.teamId,
    };
    const result = await db.update(schema.players).set(updatedData).where(eq(schema.players.id, id));

    if (result.rowsAffected && result.rowsAffected > 0) {
      const updatedPlayer = await db.query.players.findFirst({ where: eq(schema.players.id, id) });
      ctx.response.body = {
        id: updatedPlayer?.id,
        firstName: updatedPlayer?.firstName,
        lastName: updatedPlayer?.lastName,
        jerseyNumber: updatedPlayer?.jerseyNumber,
        birthDate: new Date(updatedPlayer?.birthDate || ''),
        teamId: updatedPlayer?.teamId,
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Player not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to update player", error: error.message };
  }
};