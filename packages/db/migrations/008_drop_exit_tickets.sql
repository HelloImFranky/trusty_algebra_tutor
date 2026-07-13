-- The exit ticket feature was removed from the app: drop its result log and
-- ticket definitions. Historical exit-ticket practice attempts stay in
-- attempts (context = 'exit_ticket') so lifetime answer tallies keep them.
DROP TABLE IF EXISTS exit_ticket_results;
DROP TABLE IF EXISTS exit_tickets;
