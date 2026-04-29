import { RouterContext } from "https://deno.land/x/oak@v17.1.5/mod.ts";
import { Tournament } from "../models/tournament.ts";
import { Match } from "../models/match.ts";
import { Team } from "../models/team.ts";
import tournamentService from "../services/tournamentService.ts";
import { db } from "../db/database.ts";
import * as schema from "../db/schema.ts";
import { and, eq } from "drizzle-orm";

export const getTournaments = async (ctx: RouterContext) => {
  try {
    const tournaments = await db.query.tournaments.findMany();
    ctx.response.body = tournaments.map(t => ({
      id: t.id,
      name: t.name,
      location: {
        address: t.locationAddress,
        city: t.locationCity,
        zipCode: t.locationZipCode,
      },
      date: new Date(t.date),
      teams: [], // Teams would need to be fetched via a join
      matches: [], // Matches would need to be fetched via a join
    }));
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch tournaments", error: error.message };
  }
};

export const getTournamentById = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const tournament = await db.query.tournaments.findFirst({ where: eq(schema.tournaments.id, id) });
    if (tournament) {
      const teams = await db.select().from(schema.teams).innerJoin(schema.tournamentTeams, eq(schema.teams.id, schema.tournamentTeams.teamId)).where(eq(schema.tournamentTeams.tournamentId, id));
      const matches = await db.query.matches.findMany({ where: eq(schema.matches.tournamentId, id) });

      ctx.response.body = {
        id: tournament.id,
        name: tournament.name,
        location: {
          address: tournament.locationAddress,
          city: tournament.locationCity,
          zipCode: tournament.locationZipCode,
        },
        date: new Date(tournament.date),
        teams: teams.map(t => ({ id: t.teams.id, name: t.teams.name, city: t.teams.city, players: []})),
        matches: matches.map(m => ({
          id: m.id,
          tournamentId: m.tournamentId,
          team1Id: m.team1Id,
          team2Id: m.team2Id,
          date: new Date(m.date),
          time: m.time,
          score: m.score || '',
        })),
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Tournament not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch tournament", error: error.message };
  }
};

export const createTournament = async (ctx: RouterContext) => {
  const body = await ctx.request.body.json();
  const newTournamentId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      // 1. Create teams and get their IDs
      const teamsToInsert = body.teams.map(t => ({ id: crypto.randomUUID(), name: t.name, city: t.city }));
      if (teamsToInsert.length > 0) {
        await tx.insert(schema.teams).values(teamsToInsert);
      }

      // 2. Create the tournament
      const tournamentData = {
        id: newTournamentId,
        name: body.name,
        locationAddress: body.location.address,
        locationCity: body.location.city,
        locationZipCode: body.location.zipCode,
        date: new Date(body.date).toISOString(),
      };
      await tx.insert(schema.tournaments).values(tournamentData);

      // 3. Link teams to the tournament
      const tournamentTeamsToInsert = teamsToInsert.map(t => ({ tournamentId: newTournamentId, teamId: t.id }));
      if (tournamentTeamsToInsert.length > 0) {
        await tx.insert(schema.tournamentTeams).values(tournamentTeamsToInsert);
      }

      // 4. Generate and insert matches
      const generatedMatches = tournamentService.generateMatches(teamsToInsert as Team[]);
      const matchesToInsert = generatedMatches.map(m => ({
        id: crypto.randomUUID(),
        tournamentId: newTournamentId,
        team1Id: m.team1Id,
        team2Id: m.team2Id,
        date: m.date.toISOString().split('T')[0],
        time: m.time,
        score: null,
      }));
      if (matchesToInsert.length > 0) {
        await tx.insert(schema.matches).values(matchesToInsert);
      }
    });

    const createdTournament = await db.query.tournaments.findFirst({ where: eq(schema.tournaments.id, newTournamentId) });
    const associatedTeams = await db.select().from(schema.teams).innerJoin(schema.tournamentTeams, eq(schema.teams.id, schema.tournamentTeams.teamId)).where(eq(schema.tournamentTeams.tournamentId, newTournamentId));
    const associatedMatches = await db.query.matches.findMany({ where: eq(schema.matches.tournamentId, newTournamentId) });

    ctx.response.status = 201;
    ctx.response.body = {
      id: createdTournament?.id,
      name: createdTournament?.name,
      location: {
        address: createdTournament?.locationAddress,
        city: createdTournament?.locationCity,
        zipCode: createdTournament?.locationZipCode,
      },
      date: new Date(createdTournament?.date || ''),
      teams: associatedTeams.map(t => ({ id: t.teams.id, name: t.teams.name, city: t.teams.city, players: []})),
      matches: associatedMatches.map(m => ({
        id: m.id,
        tournamentId: m.tournamentId,
        team1Id: m.team1Id,
        team2Id: m.team2Id,
        date: new Date(m.date),
        time: m.time,
        score: m.score || '',
      })),
    };

  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to create tournament", error: error.message };
  }
};

export const updateTournament = async (ctx: RouterContext) => {
  const { id } = ctx.params;
  try {
    const body = await ctx.request.body.json();
    const updatedData = {
      name: body.name,
      date: new Date(body.date).toISOString(),
      locationAddress: body.location?.address,
      locationCity: body.location?.city,
      locationZipCode: body.location?.zipCode,
    };

    const result = await db.update(schema.tournaments).set(updatedData).where(eq(schema.tournaments.id, id));

    if (result.rowsAffected && result.rowsAffected > 0) {
      const updatedTournament = await db.query.tournaments.findFirst({ where: eq(schema.tournaments.id, id) });
      ctx.response.body = {
        id: updatedTournament?.id,
        name: updatedTournament?.name,
        location: {
          address: updatedTournament?.locationAddress,
          city: updatedTournament?.locationCity,
          zipCode: updatedTournament?.locationZipCode,
        },
        date: new Date(updatedTournament?.date || ''),
        teams: [], // Not updated here
        matches: [], // Not updated here
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { message: "Tournament not found" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to update tournament", error: error.message };
  }
};

export const getTournamentMatches = async (ctx: RouterContext) => {
    const { id } = ctx.params;
    try {
        const matches = await db.query.matches.findMany({ where: eq(schema.matches.tournamentId, id) });
        ctx.response.body = matches.map(m => ({
            id: m.id,
            tournamentId: m.tournamentId,
            team1Id: m.team1Id,
            team2Id: m.team2Id,
            date: new Date(m.date),
            time: m.time,
            score: m.score || '',
        }));
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: "Failed to fetch tournament matches", error: error.message };
    }
};

export const addTournamentMatch = async (ctx: RouterContext) => {
    const { id } = ctx.params;
    try {
        const body = await ctx.request.body.json();
        const newMatchId = crypto.randomUUID();
        const matchToInsert = {
            id: newMatchId,
            tournamentId: id,
            team1Id: body.team1Id,
            team2Id: body.team2Id,
            date: new Date(body.date).toISOString().split('T')[0],
            time: body.time,
            score: body.score || null,
        };
        await db.insert(schema.matches).values(matchToInsert);
        const createdMatch = await db.query.matches.findFirst({ where: eq(schema.matches.id, newMatchId) });
        ctx.response.status = 201;
        ctx.response.body = {
            id: createdMatch?.id,
            tournamentId: createdMatch?.tournamentId,
            team1Id: createdMatch?.team1Id,
            team2Id: createdMatch?.team2Id,
            date: new Date(createdMatch?.date || ''),
            time: createdMatch?.time,
            score: createdMatch?.score || '',
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: "Failed to add match", error: error.message };
    }
};

export const updateTournamentMatch = async (ctx: RouterContext) => {
    const { id, idMatch } = ctx.params;
    try {
        const body = await ctx.request.body.json();
        const updatedData = {
            team1Id: body.team1Id,
            team2Id: body.team2Id,
            date: new Date(body.date).toISOString().split('T')[0],
            time: body.time,
            score: body.score || null,
        };
        const result = await db.update(schema.matches).set(updatedData).where(and(eq(schema.matches.id, idMatch), eq(schema.matches.tournamentId, id)));

        if (result.rowsAffected && result.rowsAffected > 0) {
            const updatedMatch = await db.query.matches.findFirst({ where: eq(schema.matches.id, idMatch) });
            ctx.response.body = {
                id: updatedMatch?.id,
                tournamentId: updatedMatch?.tournamentId,
                team1Id: updatedMatch?.team1Id,
                team2Id: updatedMatch?.team2Id,
                date: new Date(updatedMatch?.date || ''),
                time: updatedMatch?.time,
                score: updatedMatch?.score || '',
            };
        } else {
            ctx.response.status = 404;
            ctx.response.body = { message: "Match not found" };
        }
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: "Failed to update match", error: error.message };
    }
};