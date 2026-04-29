import { RouterContext } from "https://deno.land/x/oak@v17.1.5/mod.ts";
import { db } from "../db/database.ts";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";

export const getTeams = async (ctx: RouterContext) => {
  try {
    const teams = await db.query.teams.findMany();
    ctx.response.body = teams.map(t => ({
      id: t.id,
      name: t.name,
      city: t.city,
      players: [], // Players would need to be fetched via a join or separate query
    }));
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch teams", error: error.message };
  }
};

export const getTeamById = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, id) });
    if (team) {
      // Fetch associated players here if needed for the full object
      ctx.response.body = {
        id: team.id,
        name: team.name,
        city: team.city,
        players: [],
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Team not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch team", error: error.message };
  }
};

export const createTeam = async (ctx: RouterContext) => {
  try {
    const body = await ctx.request.body.json();
    const newTeamId = crypto.randomUUID();
    await db.insert(schema.teams).values({
      id: newTeamId,
      name: body.name,
      city: body.city,
    });
    const newTeam = await db.query.teams.findFirst({ where: eq(schema.teams.id, newTeamId) });
    ctx.response.status = 201;
    ctx.response.body = {
      id: newTeam?.id,
      name: newTeam?.name,
      city: newTeam?.city,
      players: [],
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to create team", error: error.message };
  }
};

export const updateTeam = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const body = await ctx.request.body.json();
    const updatedData = {
      name: body.name,
      city: body.city,
    };
    const result = await db.update(schema.teams).set(updatedData).where(eq(schema.teams.id, id));

    if (result.rowsAffected && result.rowsAffected > 0) {
      const updatedTeam = await db.query.teams.findFirst({ where: eq(schema.teams.id, id) });
      ctx.response.body = {
        id: updatedTeam?.id,
        name: updatedTeam?.name,
        city: updatedTeam?.city,
        players: [], // Players are not updated here
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Team not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to update team", error: error.message };
  }
};